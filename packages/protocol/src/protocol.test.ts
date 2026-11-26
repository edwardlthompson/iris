import { describe, expect, it } from "vitest";
import {
  HandoffV1Schema,
  LedgerRowSchema,
  ModelCardSchema,
  PoolSchema,
  ProvenanceSchema,
  RepoConfigSchema,
  ThreadEventSchema,
  parseWithPath,
} from "./index.js";
import {
  fullThreadEvents,
  sampleHandoff,
  sampleLedger,
  sampleModelCard,
  sampleProvenance,
  sampleRepoConfig,
} from "./fixtures/full-thread.js";

describe("@iris/protocol round-trip", () => {
  it("validates a full-thread fixture", () => {
    for (const event of fullThreadEvents) {
      const parsed = ThreadEventSchema.parse(event);
      expect(parsed).toEqual(event);
    }
  });

  it("validates handoff, ledger, pool, model, provenance, repo config", () => {
    expect(HandoffV1Schema.parse(sampleHandoff)).toEqual(sampleHandoff);
    expect(LedgerRowSchema.parse(sampleLedger)).toEqual(sampleLedger);
    expect(ModelCardSchema.parse(sampleModelCard)).toEqual(sampleModelCard);
    expect(ProvenanceSchema.parse(sampleProvenance)).toEqual(sampleProvenance);
    expect(RepoConfigSchema.parse(sampleRepoConfig)).toEqual(sampleRepoConfig);
    expect(
      PoolSchema.parse({
        id: "venice",
        baseUrl: "https://api.venice.ai/api/v1",
        auth: { mode: "pool", keyRef: "litellm:venice" },
        limits: { monthlyCapUsd: 50 },
      }),
    ).toMatchObject({ id: "venice" });
  });
});

describe("@iris/protocol rejection", () => {
  it("rejects a malformed event with a path", () => {
    const bad = {
      v: 1,
      seq: 0,
      ts: "2026-11-25T20:00:00.000Z",
      type: "route",
      leg: "claude",
      model: "claude-sonnet-5-5",
      effort: "medium",
      preset: "balanced",
      est_usd: 0.12,
      topology: "direct",
      // pool_id missing
    };
    const result = parseWithPath(ThreadEventSchema, bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.path).toMatch(/pool_id/);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("rejects an unknown event type with a path", () => {
    const result = parseWithPath(ThreadEventSchema, {
      v: 1,
      seq: 0,
      ts: "2026-11-25T20:00:00.000Z",
      type: "not.a.type",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.path).toBeTruthy();
    }
  });
});
