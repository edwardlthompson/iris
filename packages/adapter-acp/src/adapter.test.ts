import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { AcpClient } from "./client.js";
import { FixtureAgent } from "./fixture.js";
import { ACP_CAPABILITIES } from "./capabilities.js";

function pair(opts?: ConstructorParameters<typeof FixtureAgent>[2]): {
  client: AcpClient;
  agent: FixtureAgent;
} {
  // client→agent
  const c2a = new PassThrough();
  // agent→client
  const a2c = new PassThrough();
  const agent = new FixtureAgent(c2a, a2c, opts);
  const client = new AcpClient(c2a, a2c);
  return { client, agent };
}

describe("@iris/adapter-acp capabilities", () => {
  it("advertises baseUrlOverride for pool mode", () => {
    expect(ACP_CAPABILITIES.baseUrlOverride).toBe(true);
    expect(ACP_CAPABILITIES.streaming).toBe(true);
    expect(ACP_CAPABILITIES.toolApproval).toBe(true);
  });
});

describe("@iris/adapter-acp session", () => {
  it("streams, requests approval, and completes", async () => {
    const { client, agent } = pair({ requireApproval: true, streamDelayMs: 1 });
    const updates: unknown[] = [];
    const permissions: unknown[] = [];

    client.on("update", (u) => updates.push(u));
    client.on("permission", (p) => {
      permissions.push(p);
      client.allowTool(p.id);
    });

    const init = await client.initialize();
    expect(init.info.name).toBe("iris-fixture-agent");
    expect((init.capabilities as { baseUrlOverride?: boolean }).baseUrlOverride).toBe(true);

    const sessionId = await client.newSession(process.cwd());
    expect(sessionId).toMatch(/^sess_/);

    const result = await client.prompt("hello");
    expect(result.stopReason).toBe("end_turn");
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(permissions).toHaveLength(1);

    client.close();
    agent.close();
  });

  it("cancels cleanly mid-turn", async () => {
    const { client, agent } = pair({
      requireApproval: true,
      elicit: true,
      streamDelayMs: 30,
    });

    client.on("elicitation", (e) => {
      client.cancel();
      client.answerElicitation(e.id, "no");
    });
    client.on("permission", (p) => client.allowTool(p.id));

    await client.initialize();
    await client.newSession(process.cwd());
    const result = await client.prompt("slow");
    expect(result.stopReason).toBe("cancelled");

    client.close();
    agent.close();
  });
});
