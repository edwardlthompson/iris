import type { LedgerRow } from "@iris/protocol";
import { detectDominance } from "./dominance.js";
import { metricsBySlice } from "./metrics.js";
import { buildCard, emptyCardStore, type FitCard, type CardStore } from "./card.js";
import { reportPoolModels, type PoolModelStats } from "./pool-report.js";
import { SIGNAL_DAYS, TASK_GATE } from "./constants.js";

export type FitReport = {
  empty: boolean;
  slices: ReturnType<typeof metricsBySlice>;
  card: FitCard | null;
  poolModels: PoolModelStats[];
  reasons: string[];
};

export type ReportInput = {
  rows: LedgerRow[];
  keysPresent: Set<string>;
  windowDays?: number;
  now?: number;
  store?: CardStore;
  preferVendor?: string;
};

/** Build advisory fit report; empty when under gate or no dominance. */
export function buildFitReport(input: ReportInput): FitReport {
  const store = input.store ?? emptyCardStore();
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? SIGNAL_DAYS;
  const slices = metricsBySlice(input.rows);
  const poolModels = reportPoolModels(input.rows);
  const reasons: string[] = [];

  if (!slices.length) {
    return { empty: true, slices, card: null, poolModels, reasons: ["no_data"] };
  }

  const byDomain = new Map<string, typeof slices>();
  for (const s of slices) {
    const k = `${s.repoId}\0${s.domain}`;
    const list = byDomain.get(k) ?? [];
    list.push(s);
    byDomain.set(k, list);
  }

  let card: FitCard | null = null;
  for (const group of byDomain.values()) {
    if (group.length < 2) {
      reasons.push("need_two_vendors");
      continue;
    }
    const [a, b] = group;
    if (!a || !b) continue;
    const challenger = input.preferVendor
      ? (group.find((g) => g.vendor === input.preferVendor) ?? b)
      : b;
    const baseline = group.find((g) => g.vendor !== challenger.vendor) ?? a;
    const dom = detectDominance({
      a: baseline,
      b: challenger,
      windowDays,
      keysPresent: input.keysPresent,
    });
    if (!dom.ok) {
      reasons.push(dom.reason);
      continue;
    }
    card = buildCard(store, baseline.repoId, baseline.domain, dom, now);
    if (card) break;
    reasons.push("card_cooldown");
  }

  const underGate = slices.every((s) => s.tasks < TASK_GATE);
  return {
    empty: !card && (underGate || !slices.length),
    slices,
    card,
    poolModels,
    reasons,
  };
}
