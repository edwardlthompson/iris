import type { LegCandidacy } from "./gate.js";
import { policyGate } from "./gate.js";

export type RankedLeg = LegCandidacy & {
  /** Higher = prefer when credits remain (frontier > mid > cheap). */
  rank?: number;
};

/**
 * Among gated-eligible legs, pick the highest-rank leg that still has quota.
 * Adapts to whatever the user can actually spend — exhausted legs are skipped.
 */
export function pickBestAvailable(
  legs: RankedLeg[],
  opts?: { topology?: "direct" | "pool"; estUsd?: number; capOk?: boolean },
): string | null {
  const gate = policyGate({
    topology: opts?.topology ?? "direct",
    estUsd: opts?.estUsd ?? 0,
    capOk: opts?.capOk ?? true,
    legs,
  });
  if (!gate.ok) return null;
  const ranked = gate.legs
    .map((id) => legs.find((l) => l.id === id)!)
    .filter(Boolean)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  return ranked[0]?.id ?? null;
}
