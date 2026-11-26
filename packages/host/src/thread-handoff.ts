import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Turn = { leg: string; role: "user" | "assistant"; text: string };

const turns: Turn[] = [];

function logFile(): string {
  return join(homedir(), ".iris", "chat-log.jsonl");
}

function clean(text: string): string {
  return text
    .replace(/pairing code\s*[:*]+\s*\**\d{6}\**\.?/gi, "")
    .replace(/\bcode\s+\**\d{6}\**/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readLog(): Turn[] {
  try {
    const lines = readFileSync(logFile(), "utf8").trim().split(/\n/).slice(-8);
    return lines.flatMap((line) => {
      try {
        const row = JSON.parse(line) as Turn;
        return row.text ? [row] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

/** Last few turns, so the next program can see what the previous one was asked. */
export function handoffPreface(): string {
  const rows = (turns.length ? turns : readLog()).slice(-6).filter((t) => t.text);
  if (!rows.length) return "";
  const lines = rows.map((t) => `${t.leg} ${t.role}: ${t.text}`);
  return `Earlier Iris chat:\n${lines.join("\n")}\nContinue from that.`;
}

export function rememberTurn(leg: string, text: string, detail = ""): void {
  const said = clean(text).slice(0, 400);
  const reply = clean(detail).slice(0, 400);
  if (said) turns.push({ leg, role: "user", text: said });
  if (reply && reply !== "submitted") turns.push({ leg, role: "assistant", text: reply });
  if (turns.length > 12) turns.splice(0, turns.length - 12);
  try {
    mkdirSync(join(homedir(), ".iris"), { recursive: true });
    if (said) appendFileSync(logFile(), `${JSON.stringify({ leg, role: "user", text: said })}\n`);
    if (reply && reply !== "submitted") {
      appendFileSync(logFile(), `${JSON.stringify({ leg, role: "assistant", text: reply })}\n`);
    }
  } catch {
    /* the in-memory copy still hands off this session */
  }
}

export function withHandoff(text: string): string {
  const prior = handoffPreface();
  return prior ? `${prior}\n\n${text}` : text;
}
