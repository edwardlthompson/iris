import { describe, expect, it } from "vitest";
import type { LedgerRow } from "@iris/protocol";
import { TASK_GATE, SIGNAL_DAYS, AUTO_APPLY_AFTER } from "./constants.js";
import { metricsBySlice } from "./metrics.js";
import { detectDominance } from "./dominance.js";
import {
  buildCard,
  emptyCardStore,
  resolveCardAction,
  shouldAutoApply,
  canEmitCard,
} from "./card.js";
import { reportPoolModels } from "./pool-report.js";
import { buildFitReport } from "./report.js";

function row(partial: Partial<LedgerRow> & Pick<LedgerRow, "vendor" | "seq">): LedgerRow {
  return {
    thread_id: "t1",
    repo_id: "repo",
    model: "m",
    preset: "balanced",
    domain: "ts",
    topology: "direct",
    pool_id: null,
    stage: "1",
    confidence: 0.8,
    est_usd: 1,
    real_usd: 1,
    est_tok: 100,
    real_tok: 100,
    escalations: 0,
    rework_count: 0,
    outcome: "pass",
    shadow: false,
    ...partial,
  };
}

function many(vendor: string, n: number, usd: number, outcome: LedgerRow["outcome"] = "pass") {
  return Array.from({ length: n }, (_, i) =>
    row({ vendor, seq: i, real_usd: usd, outcome, model: `${vendor}-m` }),
  );
}

describe("@iris/plutus B9 acceptance", () => {
  it("computes per repo×vendor×domain metrics (no domain pooling)", () => {
    const rows = [
      ...many("claude", 5, 2),
      ...many("codex", 5, 1).map((r) => ({ ...r, domain: "py" })),
    ];
    const slices = metricsBySlice(rows);
    expect(slices).toHaveLength(2);
    expect(slices.map((s) => s.domain).sort()).toEqual(["py", "ts"]);
  });

  it("requires task gate, two-week window, and a key for the winner", () => {
    const a = metricsBySlice(many("a", TASK_GATE, 3))[0]!;
    const b = metricsBySlice(many("b", TASK_GATE, 1))[0]!;
    expect(
      detectDominance({ a, b, windowDays: SIGNAL_DAYS - 1, keysPresent: new Set(["b"]) }).ok,
    ).toBe(false);
    expect(
      detectDominance({ a, b, windowDays: SIGNAL_DAYS, keysPresent: new Set(["a"]) }).reason,
    ).toBe("no_key_for_winner");
    const win = detectDominance({
      a,
      b,
      windowDays: SIGNAL_DAYS,
      keysPresent: new Set(["b"]),
    });
    expect(win.ok).toBe(true);
    if (win.ok) expect(win.winner).toBe("b");
  });

  it("emits apply / keep_two / not_now; auto-apply off by default", () => {
    const store = emptyCardStore();
    const a = metricsBySlice(many("a", TASK_GATE, 3))[0]!;
    const b = metricsBySlice(many("b", TASK_GATE, 1))[0]!;
    const dom = detectDominance({
      a,
      b,
      windowDays: SIGNAL_DAYS,
      keysPresent: new Set(["b"]),
    });
    expect(dom.ok).toBe(true);
    if (!dom.ok) return;
    const card = buildCard(store, "repo", "ts", dom, 1_000_000);
    expect(card?.winner).toBe("b");
    expect(canEmitCard(store, "repo", 1_000_000 + 1000)).toBe(false);

    const keep = resolveCardAction(store, "repo", "keep_two");
    expect(keep.acceptStreak).toBe(0);
    expect(shouldAutoApply(keep)).toBe(false);

    let last = resolveCardAction(store, "repo", "apply", false);
    for (let i = 0; i < AUTO_APPLY_AFTER; i++) {
      last = resolveCardAction(store, "repo", "apply", false);
    }
    expect(shouldAutoApply(last)).toBe(false);
    last = resolveCardAction(store, "repo", "apply", true);
    for (let i = 1; i < AUTO_APPLY_AFTER; i++) {
      last = resolveCardAction(store, "repo", "apply", true);
    }
    expect(shouldAutoApply(last)).toBe(true);

    expect(resolveCardAction(store, "repo", "not_now").action).toBe("not_now");
  });

  it("reports per-pool and per-model and flags overpriced pools", () => {
    const rows: LedgerRow[] = Array.from({ length: 4 }, (_, i) =>
      row({
        vendor: "pool",
        model: "opus",
        seq: i,
        topology: "pool",
        pool_id: "venice",
        real_usd: 5,
        outcome: i === 0 ? "pass" : "fail",
      }),
    );
    const stats = reportPoolModels(rows);
    expect(stats[0]?.poolId).toBe("venice");
    expect(stats[0]?.overpriced).toBe(true);
  });

  it("empty report under gate; card when dominance clears B9", () => {
    const empty = buildFitReport({
      rows: many("a", 3, 1),
      keysPresent: new Set(["a"]),
    });
    expect(empty.empty).toBe(true);

    const report = buildFitReport({
      rows: [...many("a", TASK_GATE, 3), ...many("b", TASK_GATE, 1)],
      keysPresent: new Set(["a", "b"]),
      windowDays: SIGNAL_DAYS,
      now: Date.now(),
      preferVendor: "b",
    });
    expect(report.card?.winner).toBe("b");
    expect(report.card?.loser).toBe("a");
  });
});
