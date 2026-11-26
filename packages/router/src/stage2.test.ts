import { describe, expect, it } from "vitest";
import { policyGate } from "./gate.js";
import { Stage2Router } from "./stage2.js";
import { VeniceClient } from "./venice.js";
import { STAGE2_TIMEOUT_MS } from "./constants.js";

function jsonRes(obj: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("@iris/router policyGate", () => {
  it("excludes missing credentials and degraded pools", () => {
    const r = policyGate({
      topology: "pool",
      estUsd: 0.01,
      capOk: true,
      legs: [
        { id: "a", hasCredentials: false, quotaOk: true, poolHealth: "healthy" },
        { id: "b", hasCredentials: true, quotaOk: true, poolHealth: "degraded" },
        { id: "c", hasCredentials: true, quotaOk: true, poolHealth: "healthy" },
      ],
    });
    expect(r).toEqual({ ok: true, legs: ["c"] });
  });
});

describe("@iris/router stage2", () => {
  it("bypasses a slow Venice inside 400ms as unclassified", async () => {
    const venice = new VeniceClient({
      timeoutMs: STAGE2_TIMEOUT_MS,
      fetchImpl: async (_url, init) => {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => resolve(), 2_000);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(t);
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        });
        return jsonRes({ preset: "balanced", confidence: 0.9 });
      },
    });
    const router = new Stage2Router(venice);
    const started = Date.now();
    const out = await router.classify({
      prompt: "hard bug",
      cacheKey: "k1",
      topology: "direct",
      capOk: true,
      estUsd: 0.01,
      legs: [{ id: "claude", hasCredentials: true, quotaOk: true }],
    });
    expect(Date.now() - started).toBeLessThan(STAGE2_TIMEOUT_MS + 150);
    expect(out).toEqual({ kind: "unclassified", reason: "timeout" });
  });

  it("falls back on malformed output and caches good hits", async () => {
    let n = 0;
    const venice = new VeniceClient({
      fetchImpl: async () => {
        n += 1;
        if (n === 1) {
          return new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), {
            status: 200,
          });
        }
        return jsonRes({ preset: "performance", confidence: 0.85 });
      },
    });
    const router = new Stage2Router(venice);
    const legs = [{ id: "claude", hasCredentials: true, quotaOk: true }];
    const bad = await router.classify({
      prompt: "x",
      cacheKey: "bad",
      topology: "direct",
      capOk: true,
      estUsd: 0.01,
      legs,
    });
    expect(bad.kind).toBe("unclassified");

    const good = await router.classify({
      prompt: "y",
      cacheKey: "good",
      topology: "direct",
      capOk: true,
      estUsd: 0.01,
      legs,
    });
    expect(good).toMatchObject({ kind: "preset", preset: "performance", source: "venice" });

    const cached = await router.classify({
      prompt: "y",
      cacheKey: "good",
      topology: "direct",
      capOk: true,
      estUsd: 0.01,
      legs,
    });
    expect(cached).toMatchObject({ source: "cache" });
  });
});
