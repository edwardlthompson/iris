import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { UnifiedEvent } from "./sources-cursor.js";

type BrainConv = { id: string; title: string; project: string; mtimeMs: number; file: string };
type QueuedCall = { name: string; target: string; ts: number };

function brainDir(): string {
  return process.env.ANTIGRAVITY_BRAIN_DIR || join(homedir(), ".gemini", "antigravity", "brain");
}

function readTail(file: string, maxBytes = 300_000): { lines: string[]; mtimeMs: number } {
  const st = statSync(file);
  if (st.size <= maxBytes)
    return { lines: readFileSync(file, "utf8").split(/\r?\n/), mtimeMs: st.mtimeMs };
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    readSync(fd, buf, 0, maxBytes, st.size - maxBytes);
    return { lines: buf.toString("utf8").split(/\r?\n/).slice(1), mtimeMs: st.mtimeMs };
  } finally {
    closeSync(fd);
  }
}

function unquote(v: unknown): string {
  const s = String(v ?? "").trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      return String(JSON.parse(s));
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}

function listBrainFiles(): BrainConv[] {
  const base = brainDir();
  if (!existsSync(base)) return [];
  const out: BrainConv[] = [];
  for (const ent of readdirSync(base, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = join(base, ent.name, ".system_generated", "logs", "transcript.jsonl");
    if (!existsSync(file)) continue;
    try {
      const { lines, mtimeMs } = readTail(file, 32_768);
      let title = `Antigravity ${ent.name.slice(0, 8)}`;
      for (let i = lines.length - 1; i >= 0; i--) {
        const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/.exec(lines[i]);
        if (m?.[1]) {
          title = `Antigravity: ${m[1].replace(/\s+/g, " ").slice(0, 48)}`;
          break;
        }
      }
      out.push({ id: `ag:${ent.name}`, title, project: "Antigravity", mtimeMs, file });
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function listAntigravityBrainConversations(limit = 12): Omit<BrainConv, "file">[] {
  return listBrainFiles()
    .slice(0, limit)
    .map((c) => ({ id: c.id, title: c.title, project: c.project, mtimeMs: c.mtimeMs }));
}

function parseBrainFile(file: string, seqBase: number): UnifiedEvent[] {
  const { lines, mtimeMs } = readTail(file);
  const events: UnifiedEvent[] = [];
  const queue: QueuedCall[] = [];
  let seq = seqBase;
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    let d: {
      type?: string;
      created_at?: string;
      content?: string;
      tool_calls?: Array<{ name?: string; args?: Record<string, unknown> }>;
    };
    try {
      d = JSON.parse(line) as typeof d;
    } catch {
      continue;
    }
    const ts = Date.parse(d.created_at || "") || mtimeMs;
    if (d.type === "USER_INPUT" && typeof d.content === "string") {
      const m = /<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/.exec(d.content);
      const t = (m?.[1] || d.content).trim();
      if (t)
        events.push({ k: "human", t: t.slice(0, 4000), source: "Antigravity", ts, seq: seq++ });
    } else if (d.type === "MODEL") {
      for (const tc of d.tool_calls || []) {
        const name = tc.name || "";
        const args = tc.args || {};
        if (name === "run_command")
          queue.push({ name, target: `$ ${unquote(args.CommandLine).slice(0, 140)}`, ts });
        else if (name === "edit_file" || name === "write_file")
          queue.push({ name, target: `${name} ${basename(unquote(args.Path))}`, ts });
        else queue.push({ name, target: "", ts });
      }
      if (typeof d.content === "string" && d.content.trim()) {
        events.push({
          k: "assistant",
          t: d.content.trim().slice(0, 8000),
          source: "Antigravity",
          ts,
          seq: seq++,
        });
      }
    } else if (d.type === "GENERIC" && queue.length) {
      const call = queue.shift()!;
      if (!call.target) continue;
      const body = String(d.content || "");
      const outMatch =
        /(Command exited with code [^\n]+[\s\S]*|Made \d+ replacement[^\n]*|Created file\.?)/i.exec(
          body,
        );
      const tail = outMatch
        ? outMatch[1].trim().split(/\r?\n/).slice(0, 6).join("\n").slice(0, 320)
        : "";
      events.push({
        k: "tool",
        t: tail ? `${call.target}\n→ ${tail}` : call.target,
        source: "Antigravity",
        ts,
        seq: seq++,
      });
    } else if (d.type === "SYSTEM_MESSAGE" && typeof d.content === "string") {
      const m = /Task id "[^"]+" finished with result:\s*([\s\S]*)/.exec(d.content);
      if (m?.[1]) {
        const tail = m[1].trim().split(/\r?\n/).slice(0, 6).join("\n").slice(0, 320);
        events.push({
          k: "tool",
          t: `Background command → ${tail}`,
          source: "Antigravity",
          ts,
          seq: seq++,
        });
      }
    }
  }
  return events;
}

export function readAntigravityUnifiedEvents(maxFiles = 3): UnifiedEvent[] {
  return listBrainFiles()
    .slice(0, maxFiles)
    .flatMap((c, i) => parseBrainFile(c.file, 50_000 + i * 10_000));
}

export function readAntigravityThreadEvents(id: string): { title: string; events: UnifiedEvent[] } {
  const hit = listBrainFiles().find((c) => c.id === id);
  if (!hit) return { title: "Antigravity", events: [] };
  return { title: hit.title, events: parseBrainFile(hit.file, 0) };
}

export function antigravityBrainBusy(): boolean {
  const latest = listBrainFiles()[0];
  if (!latest || Date.now() - latest.mtimeMs > 15_000) return false;
  const { lines } = readTail(latest.file, 16_384);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith("{")) continue;
    try {
      const d = JSON.parse(lines[i]) as { type?: string; tool_calls?: unknown[] };
      return !(d.type === "MODEL" && !(d.tool_calls && d.tool_calls.length));
    } catch {
      continue;
    }
  }
  return false;
}
