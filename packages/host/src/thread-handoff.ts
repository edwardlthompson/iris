import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { repoLockLine } from "./workspace-lock.js";
import { homedir } from "node:os";
import { join } from "node:path";

type Turn = {
  leg: string;
  role: "user" | "assistant";
  text: string;
  ts?: number;
  model?: string;
  effort?: string;
};

const turns: Turn[] = [];

function irisDir(): string {
  return process.env.IRIS_HOME || join(homedir(), ".iris");
}

function logFile(): string {
  return join(irisDir(), "chat-log.jsonl");
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
    const lines = readFileSync(logFile(), "utf8").trim().split(/\n/).slice(-24);
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

function kept(row: Turn): boolean {
  return Boolean(row.text) && !/reply not captured yet/i.test(row.text);
}

/** Last few real turns from this process and the log, so the next program can continue. */
export function handoffPreface(): string {
  const seen = new Set<string>();
  const rows = [...readLog(), ...turns]
    .filter(kept)
    .filter((row) => {
      const key = `${row.leg}|${row.role}|${row.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-2);
  if (!rows.length) return "";
  const lines = rows.map((t) => `${t.leg} ${t.role}: ${t.text.slice(0, 180)}`);
  return `Earlier Iris chat:\n${lines.join("\n")}`;
}

export function rememberTurn(
  leg: string,
  text: string,
  detail = "",
  meta?: { model?: string; effort?: string },
): void {
  const saidRaw = clean(text);
  const replyRaw = clean(detail) === "submitted" ? "" : clean(detail);
  const said = saidRaw.slice(0, 400);
  const reply = replyRaw.slice(0, 400);
  const ts = Date.now();
  const model = meta?.model;
  const effort = meta?.effort;
  if (said) turns.push({ leg, role: "user", text: said, ts, model, effort });
  if (reply && reply !== "submitted")
    turns.push({ leg, role: "assistant", text: reply, ts, model, effort });
  if (turns.length > 24) turns.splice(0, turns.length - 24);
  try {
    mkdirSync(irisDir(), { recursive: true });
    if (saidRaw) {
      appendFileSync(
        logFile(),
        `${JSON.stringify({ leg, role: "user", text: saidRaw.slice(0, 4000), ts, model, effort })}\n`,
      );
    }
    if (replyRaw) {
      appendFileSync(
        logFile(),
        `${JSON.stringify({ leg, role: "assistant", text: replyRaw.slice(0, 8000), ts, model, effort })}\n`,
      );
    }
  } catch {
    /* the in-memory copy still hands off this session */
  }
}

export function withHandoff(text: string): string {
  const prior = handoffPreface();
  const body = prior ? `${prior}\n\n${text}` : text;
  return `${repoLockLine()}\n\n${body}`;
}
