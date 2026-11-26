import type { HandoffV1 } from "@iris/protocol";

export type FallbackTarget = {
  leg: string;
  model: string;
  /** Same pool as source — model-only switch in pool mode. */
  samePool?: boolean;
};

export type QuotaTriggerInput = {
  threadId: string;
  from: { leg: string; model: string };
  goal: string;
  state: HandoffV1["state"];
  constraints: string[];
  nextStep: string;
  budget: HandoffV1["budget"];
  /** Configured fallbacks in preference order. */
  fallbacks: FallbackTarget[];
  /** User must confirm before handoff commits. */
  confirmed: boolean;
  topology: "direct" | "pool";
  reason?: string;
};

export type TriggerResult =
  | { ok: true; handoff: Omit<HandoffV1, "v"> & { v: 1 } }
  | { ok: false; reason: "not_confirmed" | "no_fallback" };

/**
 * Quota-exhausted handoff: pick first fallback; in pool prefer same-pool model switch.
 * Requires manual confirm. Resume is always at the next turn boundary (next_step).
 */
export function triggerQuotaHandoff(input: QuotaTriggerInput): TriggerResult {
  if (!input.confirmed) return { ok: false, reason: "not_confirmed" };

  let targets = input.fallbacks;
  if (input.topology === "pool") {
    const same = targets.filter((t) => t.samePool);
    if (same.length) targets = same;
  }
  const to = targets[0];
  if (!to) return { ok: false, reason: "no_fallback" };

  return {
    ok: true,
    handoff: {
      v: 1,
      thread_id: input.threadId,
      from: input.from,
      to: { leg: to.leg, model: to.model },
      reason: input.reason ?? "quota_exhausted",
      goal: input.goal,
      state: input.state,
      constraints: input.constraints,
      next_step: input.nextStep,
      budget: input.budget,
    },
  };
}
