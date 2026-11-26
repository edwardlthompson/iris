import { describe, expect, it } from "vitest";
import { CLAUDE_CAPABILITIES } from "./capabilities.js";
import { QuotaStore } from "./quota.js";
import { StubClaudeRuntime } from "./stub.js";
import { ClaudeSession } from "./session.js";

describe("@iris/adapter-claude capabilities", () => {
  it("advertises headless + baseUrlOverride + quotaReporting", () => {
    expect(CLAUDE_CAPABILITIES.headless).toBe(true);
    expect(CLAUDE_CAPABILITIES.baseUrlOverride).toBe(true);
    expect(CLAUDE_CAPABILITIES.quotaReporting).toBe(true);
    expect(CLAUDE_CAPABILITIES.toolApproval).toBe(true);
  });
});

describe("@iris/adapter-claude session", () => {
  it("runs headless, records quota, honours base URL override", async () => {
    const runtime = new StubClaudeRuntime({
      echoBaseUrl: true,
      rateLimits: { inputTokensRemaining: 12_000, outputTokensRemaining: 4_000 },
    });
    const quota = new QuotaStore();
    const session = new ClaudeSession({
      runtime,
      quota,
      baseUrl: "http://127.0.0.1:4000",
    });
    const result = await session.run("hi");
    expect(result.texts[0]).toBe("base=http://127.0.0.1:4000");
    expect(result.baseUrlUsed).toBe("http://127.0.0.1:4000");
    expect(result.quota?.inputTokensRemaining).toBe(12_000);
    expect(result.stopReason).toBe("end_turn");
  });

  it("round-trips canUseTool approval", async () => {
    const runtime = new StubClaudeRuntime({ toolName: "Bash", toolInput: { cmd: "ls" } });
    const seen: string[] = [];
    const session = new ClaudeSession({
      runtime,
      approvals: {
        async request(toolName, _input, toolUseID) {
          seen.push(`${toolName}:${toolUseID}`);
          return true;
        },
      },
    });
    const result = await session.run("list");
    expect(seen).toEqual(["Bash:tool_stub_1"]);
    expect(result.texts).toContain("ran:Bash");
    expect(result.stopReason).toBe("end_turn");
  });

  it("denies tool and stops", async () => {
    const runtime = new StubClaudeRuntime({ toolName: "Bash" });
    const session = new ClaudeSession({
      runtime,
      approvals: {
        async request() {
          return false;
        },
      },
    });
    const result = await session.run("nope");
    expect(result.stopReason).toBe("permission_denied");
  });

  it("refuses PTY on the FOSS stub", async () => {
    const session = new ClaudeSession({
      runtime: new StubClaudeRuntime(),
      screen: true,
    });
    await expect(session.run("x")).rejects.toThrow(/PTY/);
  });
});
