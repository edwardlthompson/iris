import { describe, expect, it } from "vitest";
import type { ModelCard } from "@iris/protocol";
import { Chrysaor, stubPool } from "./chrysaor.js";
import { generateLiteLLMConfig } from "./litellm.js";
import { CapAccountant } from "./caps.js";

const caps = {
  headless: true,
  streaming: true,
  toolApproval: true,
  imageInput: false,
  planMode: false,
  modelSelect: true,
  effortSelect: false,
  resume: true,
  costReporting: true,
  quotaReporting: false,
  worktree: false,
  baseUrlOverride: true,
};

function card(poolId: string, canonicalId = "claude-sonnet"): ModelCard {
  return {
    canonicalId,
    poolId,
    nativeId: `${poolId}/sonnet`,
    ctx: 200_000,
    priceIn: 0.003,
    priceOut: 0.015,
    capabilities: caps,
  };
}

describe("@iris/pool caps", () => {
  it("stops an over-cap turn", () => {
    const a = new CapAccountant(1, 0.5);
    expect(a.checkTurn(0.6).ok).toBe(false);
    expect(a.checkTurn(0.1).ok).toBe(true);
    a.recordSpend(0.95);
    expect(a.checkTurn(0.1).ok).toBe(false);
  });
});

describe("@iris/pool chrysaor", () => {
  it("routes direct with no pool configured", () => {
    const c = new Chrysaor({ topology: "direct", pools: [], cards: [] });
    expect(c.route("x", 0.01)).toEqual({ topology: "direct", poolId: null });
  });

  it("routes through stub pool and skips degraded", async () => {
    const pool = stubPool("stub");
    let fails = 0;
    const c = new Chrysaor({
      topology: "pool",
      pools: [pool],
      cards: [card("stub")],
      poolOrder: ["stub"],
      probe: async () => {
        fails += 1;
        return fails > 2;
      },
    });
    expect(c.route("claude-sonnet", 0.01)).toMatchObject({
      topology: "pool",
      poolId: "stub",
      baseUrl: "http://127.0.0.1:4000",
    });
    await c.probeAll();
    await c.probeAll();
    expect(c.healthOf("stub")).toBe("degraded");
    expect(c.route("claude-sonnet", 0.01)).toEqual({
      topology: "blocked",
      reason: "no healthy pool for model",
    });
  });

  it("blocks over-cap and rejects non-localhost litellm bind", () => {
    const c = new Chrysaor({
      topology: "pool",
      pools: [stubPool()],
      cards: [card("stub")],
      perTurnCapUsd: 0.01,
    });
    expect(c.route("claude-sonnet", 0.5)).toMatchObject({ topology: "blocked" });
    const yaml = c.litellmYaml();
    expect(yaml).toContain("host: 127.0.0.1");
    expect(yaml).not.toMatch(/sk-/);
    expect(() => generateLiteLLMConfig([stubPool()], "0.0.0.0:4000")).toThrow(/127\.0\.0\.1/);
  });
});
