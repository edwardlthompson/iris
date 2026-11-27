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

export type UnifiedEvent = {
  k: "human" | "assistant" | "tool";
  t: string;
  source: string;
  model?: string;
  effort?: string;
  project?: string;
  ts: number;
  seq: number;
};

type TermEntry = { cmd: string; ts: number; status: string; tail: string };
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function cursorDir(): string {
  return process.env.CURSOR_PROJECTS_DIR || join(homedir(), ".cursor", "projects");
}

function readTail(
  file: string,
  maxBytes = 262_144,
): { text: string; partial: boolean; mtimeMs: number } {
  const size = statSync(file).size;
  const mtimeMs = statSync(file).mtimeMs;
  if (size <= maxBytes) return { text: readFileSync(file, "utf8"), partial: false, mtimeMs };
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    readSync(fd, buf, 0, maxBytes, size - maxBytes);
    return { text: buf.toString("utf8"), partial: true, mtimeMs };
  } finally {
    closeSync(fd);
  }
}

export function parseCursorTimestamp(raw: string): number | null {
  const m =
    /<timestamp>[^,]*,\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(UTC([+-]\d+(?::\d+)?)\)<\/timestamp>/i.exec(
      raw,
    );
  if (!m) return null;
  const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (mon === undefined) return null;
  let hr = Number(m[4]);
  if (m[6].toUpperCase() === "PM" && hr < 12) hr += 12;
  if (m[6].toUpperCase() === "AM" && hr === 12) hr = 0;
  const [oh, om = "0"] = m[7].split(":");
  const offMin = (Number(oh) < 0 ? -1 : 1) * (Math.abs(Number(oh)) * 60 + Number(om));
  return Date.UTC(Number(m[3]), mon, Number(m[2]), hr, Number(m[5])) - offMin * 60_000;
}

function cleanUser(raw: string): string {
  let s = raw.replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, "");
  const q = /<user_query>([\s\S]*?)<\/user_query>/i.exec(s);
  if (q) s = q[1] ?? s;
  return s
    .replace(/Iris handoff\.[\s\S]*?Continue from that\.\s*/g, "")
    .replace(/Earlier Iris chat:[\s\S]*?Continue from that\.\s*/g, "")
    .replace(
      /Briefly inform the user about the task result[\s\S]*?don't explicitly say that\.\s*/gi,
      "",
    )
    .trim();
}

function readTerminals(projDir: string): TermEntry[] {
  const dir = join(projDir, "terminals");
  if (!existsSync(dir)) return [];
  const out: TermEntry[] = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".txt"))
    .slice(-20)) {
    try {
      const raw = readFileSync(join(dir, name), "utf8");
      const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
      if (!m) continue;
      const hdr = m[1];
      const cmd = /command:\s*"?([^\r\n"]+)"?/.exec(hdr)?.[1]?.trim() || "";
      const started = /started_at:\s*([^\r\n]+)/.exec(hdr)?.[1]?.trim() || "";
      const exitCode = /exit_code:\s*([^\r\n]+)/.exec(hdr)?.[1]?.trim() || "";
      const status = /status:\s*([^\r\n]+)/.exec(hdr)?.[1]?.trim() || "";
      const ts = Date.parse(started) || statSync(join(dir, name)).mtimeMs;
      const tail = m[2].trim().split(/\r?\n/).slice(-5).join("\n").slice(0, 320);
      if (cmd) out.push({ cmd, ts, status: exitCode ? `exit ${exitCode}` : status, tail });
    } catch {
      /* skip */
    }
  }
  return out;
}

function formatTool(
  name: string,
  input: Record<string, unknown>,
  terms: TermEntry[],
): { text: string; matchedCmd?: string } {
  if (/^(Shell|Bash|RunTerminalCmd)$/i.test(name)) {
    const cmd = String(input.command || "").trim();
    const hit = terms.find((t) => cmd && (t.cmd === cmd || cmd.startsWith(t.cmd.slice(0, 40))));
    const first = cmd.split(/\r?\n/)[0].slice(0, 140);
    if (!hit) return { text: `$ ${first}` };
    const info = [hit.status, hit.tail].filter(Boolean).join("\n");
    return { text: info ? `$ ${first}\n→ ${info}` : `$ ${first}`, matchedCmd: hit.cmd };
  }
  const p = String(input.path || input.target_file || input.file_path || "");
  return { text: p ? `${name} ${basename(p)}` : name };
}

function parseFile(file: string, proj: string, seqBase: number): UnifiedEvent[] {
  const { text, partial, mtimeMs } = readTail(file);
  const lines = text.split(/\r?\n/).slice(partial ? 1 : 0);
  const terms = readTerminals(join(cursorDir(), proj));
  const matched = new Set<string>();
  const label = proj.replace(/^c-Users-[^-]+-/, "").slice(0, 24) || "Cursor";
  const events: UnifiedEvent[] = [];
  let curTs = mtimeMs - lines.length * 1000;
  let seq = seqBase;
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    let obj: { role?: string; message?: { content?: unknown } };
    try {
      obj = JSON.parse(line) as typeof obj;
    } catch {
      continue;
    }
    const parts = Array.isArray(obj.message?.content)
      ? (obj.message.content as Array<Record<string, unknown>>)
      : [];
    if (obj.role === "user") {
      const raw = parts.map((p) => String(p.text || "")).join("\n");
      const parsed = parseCursorTimestamp(raw);
      if (parsed) curTs = parsed;
      const t = cleanUser(raw);
      if (t)
        events.push({
          k: "human",
          t: t.slice(0, 4000),
          source: "Cursor",
          project: label,
          ts: (curTs += 1),
          seq: seq++,
        });
    } else if (obj.role === "assistant") {
      for (const p of parts) {
        if (p.type === "tool_use") {
          const ft = formatTool(
            String(p.name || "tool"),
            (p.input as Record<string, unknown>) || {},
            terms,
          );
          if (ft.matchedCmd) matched.add(ft.matchedCmd);
          events.push({
            k: "tool",
            t: ft.text.slice(0, 1200),
            source: "Cursor",
            project: label,
            ts: (curTs += 1),
            seq: seq++,
          });
        } else if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
          events.push({
            k: "assistant",
            t: p.text.trim().slice(0, 8000),
            source: "Cursor",
            project: label,
            ts: (curTs += 1),
            seq: seq++,
          });
        }
      }
    }
  }
  for (const term of terms) {
    if (matched.has(term.cmd)) continue;
    const info = [term.status, term.tail].filter(Boolean).join("\n");
    events.push({
      k: "tool",
      t: info ? `$ ${term.cmd.slice(0, 140)}\n→ ${info}` : `$ ${term.cmd.slice(0, 140)}`,
      source: "Cursor",
      project: label,
      ts: term.ts,
      seq: seq++,
    });
  }
  return events;
}

function listFiles(): { proj: string; file: string; mtimeMs: number }[] {
  const base = cursorDir();
  if (!existsSync(base)) return [];
  const out: { proj: string; file: string; mtimeMs: number }[] = [];
  for (const proj of readdirSync(base, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const root = join(base, proj.name, "agent-transcripts");
    if (!existsSync(root)) continue;
    for (const ent of readdirSync(root, { withFileTypes: true })) {
      const dir = ent.isDirectory() ? join(root, ent.name) : root;
      const names = ent.isDirectory() ? readdirSync(dir) : [ent.name];
      for (const n of names) {
        if (!n.endsWith(".jsonl") || n.includes("compaction") || n === "subagents") continue;
        try {
          const f = join(dir, n);
          const st = statSync(f);
          if (st.isFile() && st.size > 0)
            out.push({ proj: proj.name, file: f, mtimeMs: st.mtimeMs });
        } catch {
          /* skip */
        }
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function readCursorUnifiedEvents(maxFiles = 3): UnifiedEvent[] {
  return listFiles()
    .slice(0, maxFiles)
    .flatMap((f, i) => parseFile(f.file, f.proj, i * 10_000));
}

export function readCursorThreadEvents(id: string): { title: string; events: UnifiedEvent[] } {
  const hit = listFiles().find((f) => `${f.proj}/${basename(f.file, ".jsonl")}` === id);
  if (!hit) return { title: id, events: [] };
  return {
    title: hit.proj.replace(/^c-Users-[^-]+-/, "") || "Cursor",
    events: parseFile(hit.file, hit.proj, 0),
  };
}
