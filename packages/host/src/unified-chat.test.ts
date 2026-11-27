import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildUnifiedChat, loadChatView } from "./unified-chat.js";

const dirs: string[] = [];
const envKeys = [
  "CURSOR_PROJECTS_DIR",
  "ANTIGRAVITY_BRAIN_DIR",
  "CLAUDE_PROJECTS_DIR",
  "IRIS_HOME",
] as const;
const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of envKeys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("unified multi-source chat compilation", () => {
  it("merges Cursor, Antigravity, Claude Code, and Iris log chronologically and deduplicates", () => {
    const root = mkdtempSync(join(tmpdir(), "iris-unified-"));
    dirs.push(root);
    const cursorDir = join(root, "cursor");
    const brainDir = join(root, "brain");
    const claudeDir = join(root, "claude");
    const irisDir = join(root, "iris");
    process.env.CURSOR_PROJECTS_DIR = cursorDir;
    process.env.ANTIGRAVITY_BRAIN_DIR = brainDir;
    process.env.CLAUDE_PROJECTS_DIR = claudeDir;
    process.env.IRIS_HOME = irisDir;

    // 1. Cursor transcript + terminal output
    const cProj = join(cursorDir, "c-Users-edwar-Iris");
    mkdirSync(join(cProj, "agent-transcripts", "c1"), { recursive: true });
    mkdirSync(join(cProj, "terminals"), { recursive: true });
    writeFileSync(
      join(cProj, "terminals", "100.txt"),
      '---\ncommand: "pnpm test"\nstarted_at: 2026-11-26T22:39:05.000Z\nexit_code: 0\n---\n7 passed\n',
    );
    writeFileSync(
      join(cProj, "agent-transcripts", "c1", "c1.jsonl"),
      [
        JSON.stringify({
          role: "user",
          message: {
            content: [
              {
                type: "text",
                text: "<timestamp>Thursday, Nov 26, 2026, 6:39 PM (UTC-4)</timestamp>\n<user_query>Smoke test Iris</user_query>",
              },
            ],
          },
        }),
        JSON.stringify({
          role: "assistant",
          message: {
            content: [{ type: "tool_use", name: "Shell", input: { command: "pnpm test" } }],
          },
        }),
        JSON.stringify({
          role: "assistant",
          message: { content: [{ type: "text", text: "Cursor smoke OK." }] },
        }),
      ].join("\n"),
    );

    // 2. Claude Code transcript
    const clProj = join(claudeDir, "proj-a");
    mkdirSync(clProj, { recursive: true });
    writeFileSync(
      join(clProj, "s1.jsonl"),
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-11-26T22:40:00Z",
          message: { role: "user", content: "Check Claude session" },
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-11-26T22:40:02Z",
          message: { role: "assistant", content: [{ type: "text", text: "Claude reply." }] },
        }),
      ].join("\n"),
    );

    // 3. Antigravity brain transcript
    const agConv = join(brainDir, "conv-ag-1", ".system_generated", "logs");
    mkdirSync(agConv, { recursive: true });
    writeFileSync(
      join(agConv, "transcript.jsonl"),
      [
        JSON.stringify({
          type: "USER_INPUT",
          created_at: "2026-11-26T22:43:09Z",
          content: "<USER_REQUEST>\nCommit, push, and release.\n</USER_REQUEST>",
        }),
        JSON.stringify({
          type: "MODEL",
          created_at: "2026-11-26T22:43:10Z",
          content: "",
          tool_calls: [{ name: "run_command", args: { CommandLine: '"git status"' } }],
        }),
        JSON.stringify({
          type: "GENERIC",
          created_at: "2026-11-26T22:43:12Z",
          content: "Command exited with code 0.\nOn branch main",
        }),
        JSON.stringify({
          type: "MODEL",
          created_at: "2026-11-26T22:43:15Z",
          content: "Released v1.20.0.",
        }),
      ].join("\n"),
    );

    // 4. Iris chat-log.jsonl (one duplicate prompt + one CLI-only error)
    mkdirSync(irisDir, { recursive: true });
    writeFileSync(
      join(irisDir, "chat-log.jsonl"),
      [
        JSON.stringify({
          leg: "antigravity",
          role: "user",
          text: "Commit, push, and release.",
          ts: Date.parse("2026-11-26T22:43:09Z"),
        }),
        JSON.stringify({
          leg: "claude",
          role: "assistant",
          text: "Not logged in · Please run /login",
          ts: Date.parse("2026-11-26T22:41:00Z"),
        }),
      ].join("\n"),
    );

    const unified = buildUnifiedChat();
    expect(unified.id).toBe("unified");
    const joined = unified.items.map((i) => i.t).join("\n---\n");
    expect(joined).toContain("Smoke test Iris");
    expect(joined).toContain("$ pnpm test");
    expect(joined).toContain("exit 0");
    expect(joined).toContain("Cursor smoke OK.");
    expect(joined).toContain("Check Claude session");
    expect(joined).toContain("Claude reply.");
    expect(joined).toContain("Commit, push, and release.");
    expect(joined).toContain("$ git status");
    expect(joined).toContain("Released v1.20.0.");

    // Duplicate Antigravity prompt from chat-log.jsonl should appear only once
    const commitMatches = unified.items.filter(
      (i) => i.k === "human" && i.t.includes("Commit, push, and release."),
    );
    expect(commitMatches).toHaveLength(1);

    // Loading ag:<id> directly returns valid { k, t } items
    const agView = loadChatView("ag:conv-ag-1");
    expect(agView.items.length).toBe(3);
    expect(agView.items[0].k).toBe("human");
    expect(agView.items[1].k).toBe("tool");
    expect(agView.items[2].k).toBe("assistant");
  });
});
