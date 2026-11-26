import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..", "..");

function ps1(name: string): string {
  return join(ROOT, "packaging", "windows", name);
}

function launch(file: string, args: string[]): void {
  spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file, ...args], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  }).unref();
}

/** Start or install the tool a leg needs. Returns a short status for the phone. */
export function setupLeg(id: string): string {
  if (id === "cursor") {
    const script = ps1("start-cursor.ps1");
    if (!existsSync(script)) return "start-cursor.ps1 is missing";
    launch(script, []);
    return "Restarting Cursor on port 9222";
  }
  if (id === "antigravity") {
    const script = ps1("start-antigravity.ps1");
    if (!existsSync(script)) return "start-antigravity.ps1 is missing";
    launch(script, []);
    return "Restarting Antigravity on port 9000";
  }
  if (id === "claude") {
    const claude = join(process.env.LOCALAPPDATA ?? "", "CursorRemoteLite", "node", "claude.cmd");
    const cmd = existsSync(claude) ? claude : "claude";
    spawn(cmd, ["auth", "login", "--claudeai"], { detached: true, windowsHide: false, shell: true, stdio: "ignore" }).unref();
    return "Opening Claude subscription login. Free plan uses cloud models.";
  }
  if (id === "codex") {
    spawn("npm", ["install", "-g", "@openai/codex"], { detached: true, windowsHide: true, shell: true, stdio: "ignore" }).unref();
    return "Installing the Codex CLI. Sign in when it finishes. https://github.com/openai/codex";
  }
  return "LiteLLM is opt-in. Run the first-run wizard and set topology pool. https://docs.litellm.ai/";
}
