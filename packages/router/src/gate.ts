import type { Topology } from "@iris/protocol";

export type LegCandidacy = {
  id: string;
  hasCredentials: boolean;
  quotaOk: boolean;
  /** From chrysaor health: healthy | degraded */
  poolHealth?: "healthy" | "degraded";
  /** IDE/runtime availability; omit or true = eligible. False excludes the leg. */
  available?: boolean;
  /** Why available is false (e.g. ide_closed). Ignored by the filter. */
  disabledReason?: string;
};

export type GateResult = { ok: true; legs: string[] } | { ok: false; reason: string };

/** Filter legs by credentials, quota, cap, topology, pool health. */
export function policyGate(ctx: {
  topology: Topology;
  estUsd: number;
  capOk: boolean;
  legs: LegCandidacy[];
}): GateResult {
  if (!ctx.capOk) return { ok: false, reason: "cap" };

  const eligible = ctx.legs.filter((leg) => {
    if (!leg.hasCredentials) return false;
    if (!leg.quotaOk) return false;
    if (leg.available === false) return false;
    if (ctx.topology === "pool" && leg.poolHealth === "degraded") return false;
    return true;
  });

  if (!eligible.length) return { ok: false, reason: "no eligible legs" };
  return { ok: true, legs: eligible.map((l) => l.id) };
}
