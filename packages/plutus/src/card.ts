import { AUTO_APPLY_AFTER, CARD_COOLDOWN_MS } from "./constants.js";
import type { DominanceResult } from "./dominance.js";

export type CardAction = "apply" | "keep_two" | "not_now";

export type FitCard = {
  repoId: string;
  domain: string;
  winner: string;
  loser: string;
  projectionUsd: number;
  confidence: number;
  createdAt: number;
};

export type CardDecision = {
  action: CardAction;
  autoApplyEnabled: boolean;
  acceptStreak: number;
};

export type CardStore = {
  lastCardAt: Map<string, number>;
  acceptStreak: Map<string, number>;
};

export function emptyCardStore(): CardStore {
  return { lastCardAt: new Map(), acceptStreak: new Map() };
}

export function canEmitCard(store: CardStore, repoId: string, now: number): boolean {
  if (!store.lastCardAt.has(repoId)) return true;
  const last = store.lastCardAt.get(repoId)!;
  return now - last >= CARD_COOLDOWN_MS;
}

export function buildCard(
  store: CardStore,
  repoId: string,
  domain: string,
  dominance: Extract<DominanceResult, { ok: true }>,
  now: number,
): FitCard | null {
  if (!canEmitCard(store, repoId, now)) return null;
  store.lastCardAt.set(repoId, now);
  return {
    repoId,
    domain,
    winner: dominance.winner,
    loser: dominance.loser,
    projectionUsd: dominance.projectionUsd,
    confidence: dominance.confidence,
    createdAt: now,
  };
}

/** Tap always required; auto-apply after three acceptances when enabled (off by default). */
export function resolveCardAction(
  store: CardStore,
  repoId: string,
  action: CardAction,
  autoApplyEnabled = false,
): CardDecision {
  let streak = store.acceptStreak.get(repoId) ?? 0;
  if (action === "apply") streak += 1;
  else streak = 0;
  store.acceptStreak.set(repoId, streak);
  return { action, autoApplyEnabled, acceptStreak: streak };
}

export function shouldAutoApply(decision: CardDecision): boolean {
  return (
    decision.autoApplyEnabled &&
    decision.action === "apply" &&
    decision.acceptStreak >= AUTO_APPLY_AFTER
  );
}
