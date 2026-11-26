import { REASON_NO_CREDITS } from "./ide.js";

export type CreditSnapshot = {
  /** Remaining request/token budget in [0, 1]. 0 = exhausted. */
  remainingPct: number;
  /** Best model id the account can still call. */
  bestModel: string | null;
  models: Array<{ id: string; remainingPct: number; rank: number }>;
};

export type CreditProbe = {
  snapshot(): CreditSnapshot | Promise<CreditSnapshot>;
};

/** Pick the highest-ranked model that still has credits. */
export function bestModelWithCredits(snap: CreditSnapshot): string | null {
  const ok = snap.models
    .filter((m) => m.remainingPct > 0)
    .sort((a, b) => b.rank - a.rank || b.remainingPct - a.remainingPct);
  return ok[0]?.id ?? snap.bestModel;
}

export function creditsOk(snap: CreditSnapshot): boolean {
  return bestModelWithCredits(snap) !== null && snap.remainingPct > 0;
}

export function creditDisableReason(snap: CreditSnapshot): string | undefined {
  return creditsOk(snap) ? undefined : REASON_NO_CREDITS;
}
