/** Grok 4.7 effort ladder ranked by CursorBench (plan-limited inventory). */

export type GrokEffort = "low" | "medium" | "high" | "xhigh";

export type CursorModelPick = {
  /** Stable id used on the wire / phone chip, e.g. grok-4.7:high */
  id: string;
  /** UI label */
  label: string;
  /** Cursor picker match substring */
  pickerLabel: string;
  effort: GrokEffort;
  /** CursorBench score % */
  score: number;
  usdPerTask: number;
  /** Higher = stronger (xhigh = 4) */
  rank: number;
};

export const GROK_EFFORT_LADDER: readonly CursorModelPick[] = [
  {
    id: "grok-4.7:xhigh",
    label: "Grok 4.7 · xhigh",
    pickerLabel: "Grok 4.7",
    effort: "xhigh",
    score: 46.3,
    usdPerTask: 6.01,
    rank: 4,
  },
  {
    id: "grok-4.7:high",
    label: "Grok 4.7 · high",
    pickerLabel: "Grok 4.7",
    effort: "high",
    score: 43.9,
    usdPerTask: 4.69,
    rank: 3,
  },
  {
    id: "grok-4.7:medium",
    label: "Grok 4.7 · medium",
    pickerLabel: "Grok 4.7",
    effort: "medium",
    score: 41.6,
    usdPerTask: 3.49,
    rank: 2,
  },
  {
    id: "grok-4.7:low",
    label: "Grok 4.7 · low",
    pickerLabel: "Grok 4.7",
    effort: "low",
    score: 33.1,
    usdPerTask: 1.58,
    rank: 1,
  },
] as const;

const PRESET_TO_EFFORT: Record<string, GrokEffort> = {
  savings: "low",
  balanced: "medium",
  performance: "high",
  max: "xhigh",
};

const PRESET_ORDER = ["savings", "balanced", "performance", "max"] as const;

export function parseModelId(id: string): CursorModelPick | null {
  const hit = GROK_EFFORT_LADDER.find((m) => m.id === id);
  if (hit) return hit;
  const m = /^grok-4\.7:(low|medium|high|xhigh)$/i.exec(id.trim());
  if (!m) return null;
  return GROK_EFFORT_LADDER.find((row) => row.effort === m[1].toLowerCase()) ?? null;
}

/** Cap Stage1 suggestion so it never exceeds the user's Performance chip. */
export function capPreset(suggested: string, ceiling: string): string {
  const a = PRESET_ORDER.indexOf(suggested as (typeof PRESET_ORDER)[number]);
  const b = PRESET_ORDER.indexOf(ceiling as (typeof PRESET_ORDER)[number]);
  if (a < 0 && b < 0) return "balanced";
  if (a < 0) return ceiling;
  if (b < 0) return suggested;
  return PRESET_ORDER[Math.min(a, b)]!;
}

export function pickForPreset(preset: string): CursorModelPick {
  const effort = PRESET_TO_EFFORT[preset] ?? "medium";
  return GROK_EFFORT_LADDER.find((m) => m.effort === effort) ?? GROK_EFFORT_LADDER[2]!;
}

export type ResolveCursorModelInput =
  | { mode: "manual"; modelId: string }
  | { mode: "auto"; preset: string };

/** Resolve wire model + effort for Cursor CDP / status. */
export function resolveCursorModel(input: ResolveCursorModelInput): CursorModelPick {
  if (input.mode === "manual") {
    return parseModelId(input.modelId) ?? pickForPreset("balanced");
  }
  return pickForPreset(input.preset);
}

/** Credit inventory shaped for legs / phone model sheet. */
export function grokCreditInventory(remainingPct = 1) {
  return GROK_EFFORT_LADDER.map((m) => ({
    id: m.id,
    label: m.label,
    remainingPct,
    rank: m.rank,
    score: m.score,
    effort: m.effort,
  }));
}
