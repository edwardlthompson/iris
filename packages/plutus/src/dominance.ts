import { SIGNAL_DAYS, TASK_GATE } from "./constants.js";
import type { SliceMetrics } from "./metrics.js";

export type DominanceResult =
  | {
      ok: true;
      winner: string;
      loser: string;
      confidence: number;
      projectionUsd: number;
    }
  | { ok: false; reason: string };

/**
 * B dominates A when B ≥ A on completion and ≤ A on cost,
 * with ≥ TASK_GATE tasks each and a two-week signal window.
 */
export function detectDominance(opts: {
  a: SliceMetrics;
  b: SliceMetrics;
  windowDays: number;
  keysPresent: Set<string>;
}): DominanceResult {
  const { a, b, windowDays, keysPresent } = opts;
  if (a.repoId !== b.repoId || a.domain !== b.domain) {
    return { ok: false, reason: "slice_mismatch" };
  }
  if (a.domain !== b.domain) return { ok: false, reason: "pooled_domains" };
  if (windowDays < SIGNAL_DAYS) return { ok: false, reason: "window_too_short" };
  if (a.tasks < TASK_GATE || b.tasks < TASK_GATE) {
    return { ok: false, reason: "task_gate" };
  }
  if (!keysPresent.has(b.vendor)) {
    return { ok: false, reason: "no_key_for_winner" };
  }
  const bWins =
    b.completion >= a.completion && b.usdPerSuccess <= a.usdPerSuccess && b.vendor !== a.vendor;
  if (!bWins) return { ok: false, reason: "no_dominance" };
  const completionLift = b.completion - a.completion;
  const costRatio = a.usdPerSuccess > 0 ? b.usdPerSuccess / a.usdPerSuccess : 1;
  const confidence = Math.min(0.99, 0.5 + completionLift + (1 - costRatio) * 0.25);
  const projectionUsd = Math.max(0, (a.usdPerSuccess - b.usdPerSuccess) * TASK_GATE);
  return {
    ok: true,
    winner: b.vendor,
    loser: a.vendor,
    confidence,
    projectionUsd,
  };
}
