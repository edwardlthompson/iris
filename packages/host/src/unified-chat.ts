import { listConversations, type ChatItem } from "@iris/adapter-cursor";
import { listAntigravityHistory } from "@iris/adapter-antigravity";
import {
  readCursorThreadEvents,
  readCursorUnifiedEvents,
  type UnifiedEvent,
} from "./sources-cursor.js";
import {
  listAntigravityBrainConversations,
  readAntigravityThreadEvents,
  readAntigravityUnifiedEvents,
} from "./sources-antigravity.js";
import {
  listClaudeConversations,
  readClaudeThreadEvents,
  readClaudeUnifiedEvents,
  readIrisLogEvents,
} from "./sources-claude-iris.js";
import { lockedRepo } from "./workspace-lock.js";

function normKey(k: string, text: string): string {
  return `${k}:${text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120)}`;
}

function fmtTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatItem(ev: UnifiedEvent): ChatItem {
  const time = fmtTime(ev.ts);
  const tag = [ev.source, ev.model, ev.effort, ev.project, time].filter(Boolean).join(" · ");
  const text =
    ev.k === "tool" && !ev.t.includes("\n") && ev.t.length < 140
      ? `[${tag}] ${ev.t}`
      : `[${tag}]\n${ev.t}`;
  return { k: ev.k, t: text };
}

export function buildUnifiedChat(limit = 180): { id: string; title: string; items: ChatItem[] } {
  const ideEvents = [
    ...readCursorUnifiedEvents(),
    ...readAntigravityUnifiedEvents(),
    ...readClaudeUnifiedEvents(),
  ];
  const irisEvents = readIrisLogEvents();
  for (const ev of ideEvents) {
    const hit = irisEvents.find(
      (row) => row.model && normKey(row.k, row.t) === normKey(ev.k, ev.t),
    );
    if (!hit) continue;
    ev.model = hit.model;
    ev.effort = hit.effort;
  }
  const seen = new Set(ideEvents.map((e) => normKey(e.k, e.t)));
  const extra = irisEvents.filter((e) => !seen.has(normKey(e.k, e.t)));
  const merged = [...ideEvents, ...extra]
    .sort((a, b) => a.ts - b.ts || a.seq - b.seq)
    .slice(-limit);
  return { id: "unified", title: "Unified · All sources", items: merged.map(formatItem) };
}

export function loadChatView(id?: string): {
  source: string;
  id: string;
  title: string;
  items: ChatItem[];
} {
  if (!id || id === "unified") {
    const u = buildUnifiedChat();
    return { source: "unified", ...u };
  }
  if (id.startsWith("ag:")) {
    const th = readAntigravityThreadEvents(id);
    return { source: "antigravity", id, title: th.title, items: th.events.map(formatItem) };
  }
  if (id.startsWith("claude:")) {
    const th = readClaudeThreadEvents(id);
    return { source: "claude", id, title: th.title, items: th.events.map(formatItem) };
  }
  const th = readCursorThreadEvents(id);
  return { source: "cursor", id, title: th.title, items: th.events.map(formatItem) };
}

export function historyForRepo<T extends { id: string; title: string; project: string }>(
  rows: T[],
  repoName: string,
): T[] {
  const name = repoName.toLowerCase();
  return rows
    .filter(
      (row) => row.id === "unified" || `${row.title} ${row.project}`.toLowerCase().includes(name),
    )
    .map((row) => (row.id === "unified" ? { ...row, title: repoName, project: repoName } : row));
}

export async function listAllHistory() {
  const cursorChats = listConversations(20).map((c) => ({
    id: c.id,
    title: c.title,
    project: c.project || "Cursor",
    mtimeMs: c.mtimeMs,
  }));
  const brainAg = listAntigravityBrainConversations(12);
  const cdpAg = (await listAntigravityHistory().catch(() => [])).map((c) => ({
    id: `ag:${c.id}`,
    title: c.title,
    project: "Antigravity",
    mtimeMs: c.mtimeMs || Date.now() - 1000,
  }));
  const agIds = new Set(brainAg.map((c) => c.id));
  const claudeChats = listClaudeConversations(10);
  const combined = [
    ...brainAg,
    ...cdpAg.filter((c) => !agIds.has(c.id)),
    ...cursorChats,
    ...claudeChats,
  ].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const lockName = lockedRepo().name;
  return historyForRepo(
    [
      {
        id: "unified",
        title: lockName,
        project: lockName,
        mtimeMs: Number.MAX_SAFE_INTEGER,
      },
      ...combined,
    ],
    lockName,
  );
}
