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

function claudeDir(): string {
  return process.env.CLAUDE_PROJECTS_DIR || join(homedir(), ".claude", "projects");
}

function irisDir(): string {
  return process.env.IRIS_HOME || join(homedir(), ".iris");
}

function readTail(file: string, maxBytes = 200_000): { lines: string[]; mtimeMs: number } {
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

function listClaudeFiles(): { id: string; proj: string; file: string; mtimeMs: number }[] {
  const base = claudeDir();
  if (!existsSync(base)) return [];
  const out: { id: string; proj: string; file: string; mtimeMs: number }[] = [];
  for (const proj of readdirSync(base, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const pDir = join(base, proj.name);
    for (const n of readdirSync(pDir).filter((f) => f.endsWith(".jsonl"))) {
      try {
        const file = join(pDir, n);
        const st = statSync(file);
        if (st.isFile() && st.size > 0)
          out.push({
            id: `claude:${proj.name}/${basename(n, ".jsonl")}`,
            proj: proj.name,
            file,
            mtimeMs: st.mtimeMs,
          });
      } catch {
        /* skip */
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function noise(text: string): boolean {
  return /no stdin data received|not logged in/i.test(text);
}

function parseClaudeFile(file: string, seqBase: number): UnifiedEvent[] {
  const { lines, mtimeMs } = readTail(file);
  const events: UnifiedEvent[] = [];
  let seq = seqBase;
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    let d: {
      type?: string;
      timestamp?: string;
      message?: { role?: string; model?: string; content?: unknown };
    };
    try {
      d = JSON.parse(line) as typeof d;
    } catch {
      continue;
    }
    if (d.type !== "user" && d.type !== "assistant") continue;
    const ts = Date.parse(d.timestamp || "") || mtimeMs;
    const content = d.message?.content;
    if (typeof content === "string") {
      if (!content.trim() || noise(content)) continue;
      events.push({
        k: d.type === "user" ? "human" : "assistant",
        t: content.trim().slice(0, 4000),
        source: "Claude Code",
        model: d.message?.model,
        ts,
        seq: seq++,
      });
      continue;
    }
    if (!Array.isArray(content)) continue;
    for (const p of content as Array<Record<string, unknown>>) {
      if (p.type === "text" && typeof p.text === "string" && p.text.trim() && !noise(p.text)) {
        if (d.message?.model === "<synthetic>") continue;
        events.push({
          k: d.type === "user" ? "human" : "assistant",
          t: p.text.trim().slice(0, 8000),
          source: "Claude Code",
          model: d.message?.model,
          ts,
          seq: seq++,
        });
      } else if (p.type === "tool_use") {
        const inp = (p.input as Record<string, unknown>) || {};
        const cmd = String(inp.command || inp.file_path || inp.path || "");
        events.push({
          k: "tool",
          t: cmd ? `${p.name} ${cmd.slice(0, 140)}` : String(p.name || "tool"),
          source: "Claude Code",
          ts,
          seq: seq++,
        });
      }
    }
  }
  return events;
}

export function listClaudeConversations(
  limit = 10,
): { id: string; title: string; project: string; mtimeMs: number }[] {
  return listClaudeFiles()
    .slice(0, limit)
    .map((f) => {
      const evs = parseClaudeFile(f.file, 0);
      const firstHuman =
        evs
          .find((e) => e.k === "human")
          ?.t.replace(/\s+/g, " ")
          .slice(0, 48) || "Claude session";
      return {
        id: f.id,
        title: `Claude: ${firstHuman}`,
        project: "Claude Code",
        mtimeMs: f.mtimeMs,
      };
    });
}

export function readClaudeUnifiedEvents(maxFiles = 3): UnifiedEvent[] {
  return listClaudeFiles()
    .slice(0, maxFiles)
    .flatMap((f, i) => parseClaudeFile(f.file, 100_000 + i * 10_000));
}

export function readClaudeThreadEvents(id: string): { title: string; events: UnifiedEvent[] } {
  const hit = listClaudeFiles().find((f) => f.id === id);
  if (!hit) return { title: "Claude Code", events: [] };
  return { title: "Claude Code", events: parseClaudeFile(hit.file, 0) };
}

function legLabel(leg: string): string {
  if (leg === "antigravity") return "Antigravity";
  if (leg === "claude") return "Claude Code";
  if (leg === "cursor") return "Cursor";
  if (leg === "pool") return "LiteLLM Pool";
  return "Iris";
}

export function readIrisLogEvents(limit = 80): UnifiedEvent[] {
  const file = join(irisDir(), "chat-log.jsonl");
  if (!existsSync(file)) return [];
  try {
    const { lines, mtimeMs } = readTail(file, 100_000);
    const slice = lines.filter((l) => l.startsWith("{")).slice(-limit);
    const events: UnifiedEvent[] = [];
    for (let i = 0; i < slice.length; i++) {
      try {
        const d = JSON.parse(slice[i]) as {
          leg?: string;
          role?: string;
          text?: string;
          ts?: number;
          model?: string;
          effort?: string;
        };
        if (!d.text || noise(d.text)) continue;
        const ts = typeof d.ts === "number" ? d.ts : mtimeMs - (slice.length - i) * 1000;
        events.push({
          k: d.role === "user" ? "human" : "assistant",
          t: d.text,
          source: legLabel(d.leg || ""),
          model: d.model,
          effort: d.effort,
          ts,
          seq: 200_000 + i,
        });
      } catch {
        /* skip */
      }
    }
    return events;
  } catch {
    return [];
  }
}
