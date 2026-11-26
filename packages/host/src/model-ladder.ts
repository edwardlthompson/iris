/** Best model at each Performance level, then the next one down when quota is gone. */

export type LadderModel = {
  id: string;
  leg: "cursor" | "antigravity" | "claude";
  level: "max" | "performance" | "balanced" | "savings";
  rank: number;
  label: string;
  quota: string;
  effort?: string;
  score?: number;
  pickerLabel?: string;
  remainingPct: number;
};

const ROWS: Omit<LadderModel, "remainingPct">[] = [
  { id: "grok-4.7:xhigh", leg: "cursor", level: "max", rank: 100, label: "Grok 4.7 · xhigh", quota: "cursor", effort: "xhigh", score: 46.3, pickerLabel: "Grok 4.7" },
  { id: "ag:argon", leg: "antigravity", level: "max", rank: 90, label: "Antigravity · Argon", quota: "ag-argon", score: 44 },
  { id: "claude:opus", leg: "claude", level: "max", rank: 80, label: "Claude Opus", quota: "claude", score: 42 },
  { id: "grok-4.7:high", leg: "cursor", level: "performance", rank: 70, label: "Grok 4.7 · high", quota: "cursor", effort: "high", score: 43.9, pickerLabel: "Grok 4.7" },
  { id: "ag:gemini", leg: "antigravity", level: "performance", rank: 60, label: "Antigravity · Gemini", quota: "ag-gemini", score: 40 },
  { id: "claude:sonnet", leg: "claude", level: "performance", rank: 55, label: "Claude Sonnet", quota: "claude", score: 39 },
  { id: "grok-4.7:medium", leg: "cursor", level: "balanced", rank: 50, label: "Grok 4.7 · medium", quota: "cursor", effort: "medium", score: 41.6, pickerLabel: "Grok 4.7" },
  { id: "grok-4.7:low", leg: "cursor", level: "savings", rank: 30, label: "Grok 4.7 · low", quota: "cursor", effort: "low", score: 33.1, pickerLabel: "Grok 4.7" },
  { id: "ag:flash", leg: "antigravity", level: "savings", rank: 20, label: "Antigravity · Gemini Flash", quota: "ag-gemini", score: 28 },
  { id: "claude:haiku", leg: "claude", level: "savings", rank: 10, label: "Claude Haiku", quota: "claude", score: 24 },
];

const LEVELS = ["max", "performance", "balanced", "savings"] as const;

type Quota = { cursorLeft: number | null; groups: Record<string, number | null>; claudeOn: boolean; antiOn: boolean };

function leftOf(row: (typeof ROWS)[number], q: Quota): number {
  if (row.leg === "cursor") return q.cursorLeft == null ? 100 : q.cursorLeft;
  if (row.leg === "antigravity") {
    if (!q.antiOn) return 0;
    const n = q.groups[row.quota];
    return n == null ? 100 : n;
  }
  return q.claudeOn ? 100 : 0;
}

export function ladderInventory(q: Quota): LadderModel[] {
  return ROWS.map((row) => ({ ...row, remainingPct: leftOf(row, q) }));
}

export function findLadderModel(id: string, q: Quota): LadderModel {
  const hit = ladderInventory(q).find((m) => m.id === id);
  return hit ?? ladderInventory(q).find((m) => m.id === "grok-4.7:medium")!;
}

/** Highest model at this level that still has quota, else the next level down. */
export function pickDownLadder(level: string, q: Quota): LadderModel {
  const start = Math.max(0, LEVELS.indexOf(level as (typeof LEVELS)[number]));
  const models = ladderInventory(q);
  for (let i = start; i < LEVELS.length; i++) {
    const band = models.filter((m) => m.level === LEVELS[i] && m.remainingPct > 0);
    band.sort((a, b) => b.rank - a.rank);
    if (band[0]) return band[0];
  }
  return models[models.length - 1]!;
}
