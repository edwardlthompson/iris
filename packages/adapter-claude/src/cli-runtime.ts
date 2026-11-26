import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeMessage, ClaudeRuntime } from "./runtime.js";

/** Subscription CLI. No API key and no local model — the free plan uses Anthropic's cloud. */
export function claudeCommand(): string {
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const appData = process.env.APPDATA ?? "";
  const local = process.env.LOCALAPPDATA ?? "";
  const candidates = [
    join(appData, "npm", "claude.cmd"),
    join(local, "CursorRemoteLite", "node", "claude.cmd"),
    join(homedir(), ".local", "bin", "claude.exe"),
  ];
  return candidates.find((p) => existsSync(p)) ?? "claude";
}

export async function claudeCliStatus(): Promise<{ installed: boolean; loggedIn: boolean }> {
  const cmd = claudeCommand();
  const out = await run(cmd, ["auth", "status"], 12_000).catch(() => "");
  if (!out) {
    const version = await run(cmd, ["--version"], 8_000).catch(() => "");
    return { installed: version.trim().length > 0, loggedIn: false };
  }
  const loggedIn = /logged\s*in|authenticated|claude\.ai/i.test(out) && !/not logged in/i.test(out);
  return { installed: true, loggedIn };
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, shell: process.platform === "win32" });
    let text = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude timed out"));
    }, timeoutMs);
    child.stdout?.on("data", (b) => { text += String(b); });
    child.stderr?.on("data", (b) => { text += String(b); });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code && !text) reject(new Error(`claude exit ${code}`));
      else resolve(text);
    });
  });
}

/** Headless `claude -p`. Uses the signed-in claude.ai account, not ANTHROPIC_API_KEY. */
export function createCliClaudeRuntime(): ClaudeRuntime {
  return {
    async *query(prompt): AsyncIterable<ClaudeMessage> {
      const text = await run(claudeCommand(), ["-p", prompt, "--output-format", "text"], 120_000);
      const body = text.trim();
      if (body) yield { type: "assistant", text: body };
      yield { type: "result", stopReason: "submitted" };
    },
  };
}
