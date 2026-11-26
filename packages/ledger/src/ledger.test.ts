import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CalibrationTable } from "./calibration.js";
import { LedgerWriter } from "./writer.js";

function baseDraft(over: Partial<Parameters<LedgerWriter["draftFromEstimate"]>[0]> = {}) {
  return {
    thread_id: "th1",
    seq: 0,
    repo_id: "r1",
    vendor: "claude",
    model: "sonnet",
    preset: "balanced" as const,
    domain: "code",
    topology: "direct" as const,
    pool_id: null,
    stage: "1" as const,
    confidence: 0.8,
    est_usd: 0.02,
    est_tok: 800,
    shadow: false,
    ...over,
  };
}

describe("@iris/ledger calibration", () => {
  it("overrides reference estimate with actuals for that leg", () => {
    const table = new CalibrationTable([
      { leg: "claude", model: "sonnet", estUsd: 0.05, estTok: 1000 },
    ]);
    expect(table.estimateFor("claude", "sonnet").estUsd).toBe(0.05);
    const next = table.recordActual("claude", "sonnet", 0.01, 400);
    expect(next.estUsd).toBe(0.01);
    expect(table.estimateFor("claude", "sonnet").estUsd).toBe(0.01);
  });
});

describe("@iris/ledger writer", () => {
  it("writes a session row whose actuals override the leg reference", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iris-ledger-"));
    const calibration = new CalibrationTable([
      { leg: "claude", model: "sonnet", estUsd: 0.05, estTok: 1000 },
    ]);
    const writer = new LedgerWriter({ dir, calibration });
    const draft = writer.draftFromEstimate(baseDraft({ est_usd: 0, est_tok: 0 }));
    expect(draft.est_usd).toBe(0.05);

    const row = await writer.record(draft, {
      realUsd: 0.012,
      realTok: 420,
      outcome: "pass",
    });
    expect(row.real_usd).toBe(0.012);
    expect(row.topology).toBe("direct");
    expect(row.pool_id).toBeNull();
    expect(row.shadow).toBe(false);
    expect(writer.table.estimateFor("claude", "sonnet").estUsd).toBe(0.012);

    const again = writer.draftFromEstimate(baseDraft({ seq: 1, est_usd: 0, est_tok: 0 }));
    expect(again.est_usd).toBe(0.012);

    const all = await writer.readAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.real_usd).toBe(0.012);
  });

  it("does not calibrate on shadow rows", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iris-ledger-sh-"));
    const calibration = new CalibrationTable([
      { leg: "claude", model: "sonnet", estUsd: 0.05, estTok: 1000 },
    ]);
    const writer = new LedgerWriter({ dir, calibration });
    await writer.record(baseDraft({ shadow: true, est_usd: 0.05, est_tok: 1000 }), {
      realUsd: 0.99,
      realTok: 9,
      outcome: "pass",
    });
    expect(writer.table.estimateFor("claude", "sonnet").estUsd).toBe(0.05);
  });
});
