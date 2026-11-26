import type { LedgerRow } from "@iris/protocol";

export type PoolModelStats = {
  poolId: string;
  model: string;
  tasks: number;
  spendUsd: number;
  passRate: number;
  /** True when spend is high relative to pass rate (worth flag). */
  overpriced: boolean;
};

/** Per-pool and per-model reporting in pool topology (B9). */
export function reportPoolModels(rows: LedgerRow[]): PoolModelStats[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (row.shadow || row.topology !== "pool" || !row.pool_id) continue;
    const key = `${row.pool_id}\0${row.model}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: PoolModelStats[] = [];
  for (const list of groups.values()) {
    const first = list[0]!;
    const tasks = list.length;
    const spendUsd = list.reduce((a, r) => a + (r.real_usd ?? 0), 0);
    const passes = list.filter((r) => r.outcome === "pass").length;
    const passRate = tasks ? passes / tasks : 0;
    const usdPerTask = tasks ? spendUsd / tasks : 0;
    const overpriced = usdPerTask > 1 && passRate < 0.5;
    out.push({
      poolId: first.pool_id!,
      model: first.model,
      tasks,
      spendUsd,
      passRate,
      overpriced,
    });
  }
  return out;
}
