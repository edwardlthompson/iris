import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeOauthUsage, hasClaudeCredentials } from "./oauth-usage.js";
import type { ClaudeMessage, ClaudeRuntime } from "./runtime.js";

export { claudeOauthUsage, hasClaudeCredentials };

function bundledClaude(): string | null {
  const root = join(process.env.LOCALAPPDATA ?? "", "Claude-Data");
  if (!existsSync(root)) return null;
  for (const acct of readdirSync(root, { withFileTypes: true })) {
    if (!acct.isDirectory()) continue;
    const code = join(root, acct.name, "claude-code");
    if (!existsSync(code)) continue;
    for (const ver of readdirSync(code, { withFileTypes: true })) {
      if (!ver.isDirectory()) continue;
      const verDir = join(code, ver.name);
      for (const build of readdirSync(verDir, { withFileTypes: true })) {
        const exe = join(verDir, build.name, "claude.exe");
        if (build.isDirectory() && existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

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
    bundledClaude() ?? "",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? "claude";
}

let statusCache: { at: number; value: { installed: boolean; loggedIn: boolean } } | null = null;

export async function claudeCliStatus(): Promise<{ installed: boolean; loggedIn: boolean }> {
  const now = Date.now();
  if (statusCache && now - statusCache.at < 60_000) return statusCache.value;
  const cmd = claudeCommand();
  const out = await run(cmd, ["auth", "status"], 12_000).catch(() => "");
  if (!out) {
    const creds = hasClaudeCredentials();
    const version = creds ? "ok" : await run(cmd, ["--version"], 8_000).catch(() => "");
    const fallback = {
      installed: creds || version.trim().length > 0,
      loggedIn: creds || (statusCache?.value.loggedIn ?? false),
    };
    statusCache = { at: now, value: fallback };
    return fallback;
  }
  let loggedIn = false;
  try {
    loggedIn = JSON.parse(out).loggedIn === true;
  } catch {
    loggedIn = /"loggedIn"\s*:\s*true|logged in/i.test(out) && !/not logged in/i.test(out);
  }
  const value = { installed: true, loggedIn: loggedIn || hasClaudeCredentials() };
  statusCache = { at: now, value };
  return value;
}

function claudeModelArg(model: string): string {
  const id = model.replace(/^claude:/, "").toLowerCase();
  if (id.startsWith("haiku")) return "haiku";
  if (id.startsWith("sonnet")) return "sonnet";
  if (id.startsWith("opus")) return "opus";
  if (id.startsWith("fable")) return "fable";
  return id;
}

function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      windowsHide: true,
      shell: process.platform === "win32" && !cmd.toLowerCase().endsWith(".exe"),
      stdio: ["ignore", "pipe", "pipe"],
      env: env ?? process.env,
    });
    let text = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude timed out"));
    }, timeoutMs);
    child.stdout?.on("data", (b) => {
      text += String(b);
    });
    child.stderr?.on("data", (b) => {
      text += String(b);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
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
    async *query(prompt, options): AsyncIterable<ClaudeMessage> {
      const args = [
        "-p",
        prompt,
        "--output-format",
        "text",
        "--permission-mode",
        "bypassPermissions",
        "--allow-dangerously-skip-permissions",
        "--dangerously-skip-permissions",
      ];
      if (options?.model) args.splice(1, 0, "--model", claudeModelArg(options.model));
      const text = (await run(claudeCommand(), args, 120_000, options?.env))
        .split(/\r?\n/)
        .filter((line) => !/no stdin data received|not logged in/i.test(line))
        .join("\n");
      const body = text.trim();
      if (body) yield { type: "assistant", text: body };
      yield { type: "result", stopReason: "submitted" };
    },
  };
}
