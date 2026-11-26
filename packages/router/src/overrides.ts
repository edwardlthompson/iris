import type { PresetId } from "@iris/protocol";

const ORDER: PresetId[] = ["savings", "balanced", "performance", "max"];

export type OverrideInput = {
  /** User pin beats classifier. */
  pin?: PresetId;
  diffLines?: number;
  diffFileCount?: number;
  prompt?: string;
  signals?: string[];
  /** Recent consecutive failures on current preset. */
  failCount?: number;
  /** Quota remaining 0–1. */
  quotaPct?: number;
};

function atLeast(current: PresetId, floor: PresetId): PresetId {
  return ORDER.indexOf(current) < ORDER.indexOf(floor) ? floor : current;
}

function cheaper(current: PresetId): PresetId {
  const i = ORDER.indexOf(current);
  return i <= 0 ? current : ORDER[i - 1]!;
}

/**
 * Override ordering (B7): pin → large diff → failures → math/debug-hard → low quota.
 * Applied after raw stage-1 score mapping.
 */
export function applyOverrides(preset: PresetId, o: OverrideInput): PresetId {
  if (o.pin) return o.pin;

  let out = preset;
  const lines = o.diffLines ?? 0;
  const files = o.diffFileCount ?? 0;
  if (lines > 400 || files > 8) out = atLeast(out, "balanced");

  if ((o.failCount ?? 0) >= 2) {
    const i = ORDER.indexOf(out);
    out = ORDER[Math.min(i + 1, ORDER.length - 1)]!;
  }

  const prompt = o.prompt ?? "";
  const signals = o.signals ?? [];
  if (
    signals.includes("math") ||
    /\bdebug-hard\b/i.test(prompt) ||
    (/\bdebug\b/i.test(prompt) && signals.includes("stack trace"))
  ) {
    out = atLeast(out, "performance");
  }

  if (o.quotaPct !== undefined && o.quotaPct < 0.15) out = cheaper(out);
  return out;
}
