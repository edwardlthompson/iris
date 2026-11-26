import type { PresetId, Topology } from "@iris/protocol";
import { BENCHMARK_REF, PRESET_POLICIES } from "./presets.js";
import type { PinStore } from "./pin-store.js";

export type BudgetTone = "ok" | "warn" | "over";

export type CostChipSnapshot = {
  leg: string;
  model: string;
  effort: string;
  estimateUsd: number;
  pool: string | null;
  topology: Topology;
  preset: PresetId;
  pinned: boolean;
  mode: "suggest" | "off" | "auto" | "shadow";
  budgetTone: BudgetTone;
  refLabel: string;
};

export type CostChipInput = {
  leg: string;
  model?: string;
  effort?: string;
  estimateUsd: number;
  poolId?: string | null;
  topology: Topology;
  suggestedPreset: PresetId;
  mode?: CostChipSnapshot["mode"];
};

const DEBOUNCE_MS = 400;

/** Route cost chip — 400ms debounce, budget colour, pin, topology/pool. */
export class CostChipController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latest: CostChipSnapshot | null = null;
  private listeners = new Set<(s: CostChipSnapshot) => void>();

  constructor(private readonly pins: PinStore) {}

  get debounceMs(): number {
    return DEBOUNCE_MS;
  }

  get snapshot(): CostChipSnapshot | null {
    return this.latest;
  }

  subscribe(fn: (s: CostChipSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  pin(preset: PresetId | null): void {
    this.pins.set(preset);
    if (this.latest) this.emit(this.buildFromLatest(this.latest, preset));
  }

  /** Debounced update — coalesces rapid estimate changes. */
  update(input: CostChipInput): Promise<CostChipSnapshot> {
    return new Promise((resolve) => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const snap = this.build(input);
        this.latest = snap;
        this.emit(snap);
        resolve(snap);
      }, DEBOUNCE_MS);
    });
  }

  /** Immediate build for tests / first paint. */
  build(input: CostChipInput): CostChipSnapshot {
    const pinned = this.pins.get();
    const preset = pinned ?? input.suggestedPreset;
    const policy = PRESET_POLICIES[preset];
    const model = input.model ?? policy.default;
    const effort = input.effort ?? policy.effort_start;
    return {
      leg: input.leg,
      model,
      effort,
      estimateUsd: input.estimateUsd,
      pool: input.topology === "pool" ? (input.poolId ?? null) : null,
      topology: input.topology,
      preset,
      pinned: pinned !== null,
      mode: input.mode ?? "suggest",
      budgetTone: budgetTone(preset, input.estimateUsd),
      refLabel: BENCHMARK_REF,
    };
  }

  private buildFromLatest(prev: CostChipSnapshot, pin: PresetId | null): CostChipSnapshot {
    return this.build({
      leg: prev.leg,
      model: prev.model,
      effort: prev.effort,
      estimateUsd: prev.estimateUsd,
      poolId: prev.pool,
      topology: prev.topology,
      suggestedPreset: pin ?? prev.preset,
      mode: prev.mode,
    });
  }

  private emit(s: CostChipSnapshot): void {
    for (const fn of this.listeners) fn(s);
  }
}

export function budgetTone(preset: PresetId, estimateUsd: number): BudgetTone {
  const p = PRESET_POLICIES[preset];
  const hard = p.hard_cap_usd ?? p.cap_usd ?? Infinity;
  const warn = p.warn_usd ?? (p.cap_usd !== undefined ? p.cap_usd * 0.8 : Infinity);
  if (estimateUsd >= hard) return "over";
  if (estimateUsd >= warn) return "warn";
  return "ok";
}

/** Accessible one-line summary for the chip (i18n keys resolved by caller). */
export function formatChipLine(s: CostChipSnapshot): string {
  const pool = s.pool ? ` · pool ${s.pool}` : "";
  return `${s.leg} · ${s.model} · ${s.effort} · $${s.estimateUsd.toFixed(2)}${pool}`;
}
