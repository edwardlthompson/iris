import type { PresetId } from "@iris/protocol";

export type ShadowPair = {
  promptId: string;
  suggested: { leg: string; preset: PresetId };
  actual: { leg: string; preset: PresetId };
  matched: boolean;
  note?: string;
};

/** Paired shadow row: what proteus would pick vs what ran. */
export function pairShadow(opts: {
  promptId: string;
  suggestedLeg: string;
  suggestedPreset: PresetId;
  actualLeg: string;
  actualPreset: PresetId;
  escalationNote?: string;
}): ShadowPair {
  const suggested = { leg: opts.suggestedLeg, preset: opts.suggestedPreset };
  const actual = { leg: opts.actualLeg, preset: opts.actualPreset };
  return {
    promptId: opts.promptId,
    suggested,
    actual,
    matched: suggested.leg === actual.leg && suggested.preset === actual.preset,
    note: opts.escalationNote,
  };
}

export class ShadowLog {
  private readonly pairs: ShadowPair[] = [];

  append(pair: ShadowPair): void {
    this.pairs.push(pair);
  }

  all(): readonly ShadowPair[] {
    return this.pairs;
  }

  count(): number {
    return this.pairs.length;
  }
}
