import {
  existsSync,
  openSync,
  readSync,
  closeSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

export type ChatItem = { k: "human" | "assistant" | "tool"; t: string };
export type ConversationRef = {
  id: string;
  title: string;
  project: string;
  file: string;
  mtimeMs: number;
};

function projectsDir(): string {
  return process.env.CURSOR_PROJECTS_DIR || join(homedir(), ".cursor", "projects");
}

function cleanUserText(raw: string): string {
  let s = String(raw || "");
  s = s.replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, "");
  const q = /<user_query>([\s\S]*?)<\/user_query>/i.exec(s);
  if (q) s = q[1] ?? s;
  s = s.replace(/Iris handoff\. Earlier turns:[\s\S]*?Continue from that\.\s*/g, "");
  s = s.replace(
    /Briefly inform the user about the task result[\s\S]*?don't explicitly say that\.\s*/gi,
    "",
  );
  s = s.replace(/Earlier Iris chat:[\s\S]*?Continue from that\.\s*/g, "");
  return stripPairingNoise(s);
}

function stripPairingNoise(raw: string): string {
  return raw
    .replace(/[^.!\n]*pairing code[^.!\n]*[.!]?/gi, "")
    .replace(/The previous host stopped because it was replaced[^.!\n]*[.!]?/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function contentText(message: { content?: unknown } | undefined): string {
  const parts = message?.content;
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
    .map((p) => p.text || "")
    .join("\n")
    .trim();
}

function findTranscriptFiles(): ConversationRef[] {
  const base = projectsDir();
  if (!existsSync(base)) return [];
  const found: ConversationRef[] = [];
  for (const proj of readdirSync(base, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const root = join(base, proj.name, "agent-transcripts");
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const dir = entry.isDirectory() ? join(root, entry.name) : root;
      const convId = entry.isDirectory() ? entry.name : basename(entry.name, ".jsonl");
      const names = entry.isDirectory()
        ? readdirSync(dir).filter((n) => n.endsWith(".jsonl") && !n.includes("compaction"))
        : entry.name.endsWith(".jsonl") && !entry.name.includes("compaction")
          ? [entry.name]
          : [];
      for (const name of names) {
        const file = join(dir, name);
        try {
          const st = statSync(file);
          if (!st.isFile() || st.size <= 0) continue;
          found.push({
            id: `${proj.name}/${convId}`,
            title: "",
            project: proj.name,
            file,
            mtimeMs: st.mtimeMs,
          });
        } catch {
          /* skip */
        }
      }
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function tailText(file: string, bytes = 12_000): string {
  const fd = openSync(file, "r");
  try {
    const size = statSync(file).size;
    const len = Math.min(bytes, size);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, Math.max(0, size - len));
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function summarizeTitle(file: string, project: string): string {
  try {
    let lastUser = "";
    for (const l of tailText(file).split(/\r?\n/)) {
      if (!l.includes('"role":"user"') && !l.includes('"role": "user"')) continue;
      try {
        const obj = JSON.parse(l) as { role?: string; message?: { content?: unknown } };
        if (obj.role === "user") {
          const t = cleanUserText(contentText(obj.message));
          if (t) lastUser = t;
        }
      } catch {
        /* skip a partial first line */
      }
    }
    const label = project.replace(/^c-Users-[^-]+-/, "").slice(0, 24) || "Cursor";
    const snip = lastUser.replace(/\s+/g, " ").slice(0, 48);
    return snip ? `${label}: ${snip}${lastUser.length > 48 ? "…" : ""}` : label;
  } catch {
    return project;
  }
}

export function listConversations(limit = 20): ConversationRef[] {
  return findTranscriptFiles()
    .slice(0, limit)
    .map((c) => ({ ...c, title: summarizeTitle(c.file, c.project) }));
}

export function latestTranscriptPath(preferProject = "Iris"): string | null {
  const all = findTranscriptFiles();
  const preferred = all.find((c) => c.project.toLowerCase().includes(preferProject.toLowerCase()));
  return (preferred ?? all[0])?.file ?? null;
}

export function conversationById(id: string): ConversationRef | null {
  return findTranscriptFiles().find((c) => c.id === id) ?? null;
}

export function readTranscriptItems(file: string | null, limit = 160): ChatItem[] {
  if (!file || !existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const items: ChatItem[] = [];
  for (const line of lines) {
    if (!line || line[0] !== "{") continue;
    let obj: { role?: string; message?: { content?: unknown } };
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.role === "user") {
      const t = cleanUserText(contentText(obj.message));
      if (t) items.push({ k: "human", t: t.slice(0, 8000) });
    } else if (obj.role === "assistant") {
      const t = contentText(obj.message)
        .replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, "")
        .trim();
      const shown = stripPairingNoise(t);
      if (shown) items.push({ k: "assistant", t: shown.slice(0, 20000) });
    }
  }
  return items.slice(-limit);
}

export function loadLatestChat(preferProject = "Iris"): {
  file: string | null;
  items: ChatItem[];
} {
  const file = latestTranscriptPath(preferProject);
  return { file, items: readTranscriptItems(file) };
}

export function loadChatById(id: string): {
  file: string | null;
  items: ChatItem[];
  title: string;
} {
  const conv = conversationById(id);
  if (!conv) return { file: null, items: [], title: "" };
  return {
    file: conv.file,
    items: readTranscriptItems(conv.file),
    title: summarizeTitle(conv.file, conv.project),
  };
}
