export type CapDecision = { ok: true } | { ok: false; reason: string };

/** Local monthly + per-turn caps (Iris is authority, not the pool dashboard). */
export class CapAccountant {
  private spent = 0;

  constructor(
    private readonly monthlyCapUsd: number | null,
    private readonly perTurnCapUsd: number | null = null,
  ) {}

  get monthlySpentUsd(): number {
    return this.spent;
  }

  checkTurn(estUsd: number): CapDecision {
    if (this.perTurnCapUsd !== null && estUsd > this.perTurnCapUsd) {
      return { ok: false, reason: "per-turn cap" };
    }
    if (this.monthlyCapUsd !== null && this.spent + estUsd > this.monthlyCapUsd) {
      return { ok: false, reason: "monthly cap" };
    }
    return { ok: true };
  }

  recordSpend(usd: number): void {
    this.spent += usd;
  }
}
