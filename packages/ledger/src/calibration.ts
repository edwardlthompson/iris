/** Per-leg reference estimates (USD / tokens) before actuals override. */
export type LegRef = {
  leg: string;
  model: string;
  estUsd: number;
  estTok: number;
};

export class CalibrationTable {
  private readonly byKey = new Map<string, LegRef>();
  private readonly actuals = new Map<string, { realUsd: number; realTok: number; n: number }>();

  constructor(refs: LegRef[] = []) {
    for (const r of refs) this.byKey.set(this.key(r.leg, r.model), { ...r });
  }

  reference(leg: string, model: string): LegRef | null {
    return this.byKey.get(this.key(leg, model)) ?? null;
  }

  /** After a non-shadow session, fold actuals into the running mean for that leg. */
  recordActual(leg: string, model: string, realUsd: number, realTok: number): LegRef {
    const k = this.key(leg, model);
    const prev = this.actuals.get(k) ?? { realUsd: 0, realTok: 0, n: 0 };
    const n = prev.n + 1;
    const next = {
      realUsd: prev.realUsd + (realUsd - prev.realUsd) / n,
      realTok: prev.realTok + (realTok - prev.realTok) / n,
      n,
    };
    this.actuals.set(k, next);
    const ref: LegRef = {
      leg,
      model,
      estUsd: next.realUsd,
      estTok: Math.round(next.realTok),
    };
    this.byKey.set(k, ref);
    return ref;
  }

  estimateFor(leg: string, model: string): { estUsd: number; estTok: number } {
    const ref = this.reference(leg, model);
    if (ref) return { estUsd: ref.estUsd, estTok: ref.estTok };
    return { estUsd: 0, estTok: 0 };
  }

  private key(leg: string, model: string): string {
    return `${leg}::${model}`;
  }
}
