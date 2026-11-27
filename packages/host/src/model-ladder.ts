import { buildPoolLadderModels, formatPoolLabel } from "./pool-models.js";

/** Best model at each Performance level, then the next one down when quota is gone. */

export type LadderModel = {
  id: string;
  leg: "cursor" | "antigravity" | "claude" | "pool";
  level: "max" | "performance" | "balanced" | "savings";
  rank: number;
  label: string;
  quota: string;
  effort?: string;
  score?: number;
  pickerLabel?: string;
  remainingPct: number;
};

/** Rank is efficiency on the CursorBench frontier (higher first). Dominated rows, including every Grok effort, sit last. */
const ROWS: Omit<LadderModel, "remainingPct">[] = [
  {
    id: "claude:haiku-5.5",
    leg: "claude",
    level: "savings",
    rank: 100,
    label: "Claude Haiku 5.5",
    quota: "claude",
    effort: "max",
    score: 48.4,
  },
  {
    id: "claude:sonnet-5.5",
    leg: "claude",
    level: "balanced",
    rank: 90,
    label: "Claude Sonnet 5.5",
    quota: "claude",
    effort: "xhigh",
    score: 53.1,
  },
  {
    id: "claude:opus-5.5",
    leg: "claude",
    level: "performance",
    rank: 80,
    label: "Claude Opus 5.5",
    quota: "claude",
    effort: "high",
    score: 56,
  },
  {
    id: "claude:fable-5.2",
    leg: "claude",
    level: "max",
    rank: 70,
    label: "Claude Fable 5.2",
    quota: "claude",
    effort: "max",
    score: 60,
  },
  {
    id: "ag:claude-opus-5.5:high",
    leg: "antigravity",
    level: "max",
    rank: 69,
    label: "Antigravity · Claude Opus 5.5 High",
    quota: "ag-claudegpt",
    effort: "high",
    pickerLabel: "Claude Opus 5.5",
    score: 58,
  },
  {
    id: "ag:claude-opus-5.5",
    leg: "antigravity",
    level: "performance",
    rank: 68,
    label: "Antigravity · Claude Opus 5.5",
    quota: "ag-claudegpt",
    effort: "medium",
    pickerLabel: "Claude Opus 5.5",
    score: 56,
  },
  {
    id: "ag:claude-sonnet-5.5",
    leg: "antigravity",
    level: "balanced",
    rank: 66,
    label: "Antigravity · Claude Sonnet 5.5",
    quota: "ag-claudegpt",
    effort: "medium",
    pickerLabel: "Claude Sonnet 5.5",
    score: 53.1,
  },
  {
    id: "ag:claude",
    leg: "antigravity",
    level: "savings",
    rank: 60,
    label: "Antigravity · Claude",
    quota: "ag-claudegpt",
    effort: "low",
    pickerLabel: "Claude Sonnet 5.5",
    score: 53,
  },
  {
    id: "ag:gemini-4-neon",
    leg: "antigravity",
    level: "performance",
    rank: 52,
    label: "Antigravity · Gemini 4 Neon",
    quota: "ag-gemini",
    effort: "medium",
    pickerLabel: "Gemini 4 Neon",
    score: 51,
  },
  {
    id: "ag:gemini-4-carbon",
    leg: "antigravity",
    level: "balanced",
    rank: 50,
    label: "Antigravity · Gemini 4 Carbon",
    quota: "ag-gemini",
    effort: "medium",
    pickerLabel: "Gemini 4 Carbon",
    score: 49,
  },
  {
    id: "ag:gpt-oss-120b",
    leg: "antigravity",
    level: "savings",
    rank: 45,
    label: "Antigravity · GPT-OSS 120B",
    quota: "ag-claudegpt",
    pickerLabel: "GPT-OSS 120B",
    score: 44,
  },
  {
    id: "grok-4.7:low",
    leg: "cursor",
    level: "savings",
    rank: 40,
    label: "Grok 4.7 · low",
    quota: "cursor",
    effort: "low",
    score: 33.1,
    pickerLabel: "Grok 4.7",
  },
  {
    id: "grok-4.7:medium",
    leg: "cursor",
    level: "balanced",
    rank: 30,
    label: "Grok 4.7 · medium",
    quota: "cursor",
    effort: "medium",
    score: 41.6,
    pickerLabel: "Grok 4.7",
  },
  {
    id: "grok-4.7:high",
    leg: "cursor",
    level: "performance",
    rank: 20,
    label: "Grok 4.7 · high",
    quota: "cursor",
    effort: "high",
    score: 43.9,
    pickerLabel: "Grok 4.7",
  },
  {
    id: "grok-4.7:xhigh",
    leg: "cursor",
    level: "max",
    rank: 10,
    label: "Grok 4.7 · xhigh",
    quota: "cursor",
    effort: "xhigh",
    score: 46.3,
    pickerLabel: "Grok 4.7",
  },
  {
    id: "ag:flash",
    leg: "antigravity",
    level: "savings",
    rank: 5,
    label: "Antigravity · Gemini Flash",
    quota: "ag-gemini",
    effort: "low",
    pickerLabel: "Gemini 3.8 Flash",
    score: 28,
  },
];

const LEVELS = ["max", "performance", "balanced", "savings"] as const;

type Quota = {
  cursorLeft: number | null;
  groups: Record<string, number | null>;
  claudeOn: boolean;
  antiOn: boolean;
  poolOn?: boolean;
  poolLeft?: number | null;
  poolModel?: string | null;
  poolModels?: string[];
};

function leftOf(row: (typeof ROWS)[number], q: Quota): number {
  if (row.leg === "cursor") return q.cursorLeft == null ? 100 : q.cursorLeft;
  if (row.leg === "antigravity") {
    if (!q.antiOn) return 0;
    const named = q.groups[row.quota];
    if (named != null) return named;
    const want = row.quota.includes("claude") ? /claude|gpt/ : /gemini/;
    const hit = Object.entries(q.groups).find(([key]) => want.test(key));
    if (hit) return hit[1] ?? 0;
    return Object.keys(q.groups).length ? 0 : 100;
  }
  return q.claudeOn ? 100 : 0;
}

export function ladderInventory(q: Quota): LadderModel[] {
  const base = ROWS.map((row) => ({ ...row, remainingPct: leftOf(row, q) }));
  if (q.poolOn) {
    base.push(
      ...buildPoolLadderModels({
        poolModels: q.poolModels,
        defaultModel: q.poolModel ?? "default",
        remainingPct: q.poolLeft ?? 100,
      }),
    );
  }
  return base;
}

export function findLadderModel(id: string, q: Quota): LadderModel {
  const inv = ladderInventory(q);
  const hit = inv.find((m) => m.id === id);
  if (hit) return hit;
  if (id.startsWith("pool:")) {
    return {
      id,
      leg: "pool",
      level: "balanced",
      rank: 65,
      label: formatPoolLabel(id),
      quota: "pool",
      score: 52,
      remainingPct: q.poolOn ? (q.poolLeft ?? 100) : 0,
    };
  }
  return inv.find((m) => m.id === "grok-4.7:medium")!;
}

function levelIndex(level: string): number {
  const i = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  return i < 0 ? LEVELS.length - 1 : i;
}

/** Funded models at this band, then the next cheaper model, then a richer one only if the band is empty. */
export function fallbackOrder(level: string, q: Quota): LadderModel[] {
  const start = levelIndex(level);
  const funded = ladderInventory(q).filter((m) => m.remainingPct > 0);
  const byModel = (a: LadderModel, b: LadderModel) =>
    (b.score ?? 0) - (a.score ?? 0) || b.remainingPct - a.remainingPct;
  const exact = funded.filter((m) => levelIndex(m.level) === start).sort(byModel);
  const cheaper = funded.filter((m) => levelIndex(m.level) > start).sort(byModel);
  const richer = funded.filter((m) => levelIndex(m.level) < start);
  richer.sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || b.remainingPct - a.remainingPct);
  return [...exact, ...cheaper, ...richer];
}

/** Best funded model for this band. Same model on two programs follows remaining tokens. */
export function pickDownLadder(level: string, q: Quota): LadderModel {
  const models = ladderInventory(q);
  return fallbackOrder(level, q)[0] ?? models[models.length - 1]!;
}
