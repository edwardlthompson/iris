import type { LedgerRow } from "@iris/protocol";

export type SliceKey = {
  repoId: string;
  vendor: string;
  domain: string;
};

export type SliceMetrics = SliceKey & {
  tasks: number;
  completion: number;
  usdPerSuccess: number;
  abandonedSpend: number;
  escalationRate: number;
  reworkRate: number;
  medianTurns: number;
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Metrics per repo × vendor × domain (never pool domains — B9). */
export function metricsBySlice(rows: LedgerRow[]): SliceMetrics[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (row.shadow) continue;
    const key = `${row.repo_id}\0${row.vendor}\0${row.domain}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: SliceMetrics[] = [];
  for (const list of groups.values()) {
    const first = list[0]!;
    const tasks = list.length;
    const passes = list.filter((r) => r.outcome === "pass");
    const abandoned = list.filter((r) => r.outcome === "abandoned");
    const completion = tasks ? passes.length / tasks : 0;
    const successUsd = passes.reduce((a, r) => a + (r.real_usd ?? 0), 0);
    const usdPerSuccess = passes.length ? successUsd / passes.length : 0;
    const abandonedSpend = abandoned.reduce((a, r) => a + (r.real_usd ?? 0), 0);
    const escalationRate = list.reduce((a, r) => a + r.escalations, 0) / tasks;
    const reworkRate = list.reduce((a, r) => a + r.rework_count, 0) / tasks;
    const medianTurns = median(list.map((r) => r.seq + 1));
    out.push({
      repoId: first.repo_id,
      vendor: first.vendor,
      domain: first.domain,
      tasks,
      completion,
      usdPerSuccess,
      abandonedSpend,
      escalationRate,
      reworkRate,
      medianTurns,
    });
  }
  return out;
}
