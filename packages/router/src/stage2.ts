import type { PresetId } from "@iris/protocol";
import { TtlCache } from "./cache.js";
import { BACKOFF_MS, PAUSE_AFTER_FAILURES_S } from "./constants.js";
import { policyGate, type LegCandidacy } from "./gate.js";
import { VeniceClient, belowFloor, type VeniceDecision } from "./venice.js";
import type { Topology } from "@iris/protocol";

export type Stage2Outcome =
  | { kind: "preset"; preset: PresetId; confidence: number; source: "venice" | "cache" }
  | { kind: "unclassified"; reason: string };

export type Stage2Input = {
  prompt: string;
  cacheKey: string;
  topology: Topology;
  capOk: boolean;
  estUsd: number;
  legs: LegCandidacy[];
};

/** Stage 2 Venice path with cache, timeout/malformed → unclassified, policy gate. */
export class Stage2Router {
  private readonly cache = new TtlCache<VeniceDecision>();
  private consecutiveFails = 0;
  private pauseUntil = 0;
  private backoffIdx = 0;

  constructor(private readonly venice: VeniceClient) {}

  get paused(): boolean {
    return Date.now() < this.pauseUntil || this.venice.isPaused;
  }

  async classify(input: Stage2Input): Promise<Stage2Outcome> {
    const gate = policyGate({
      topology: input.topology,
      estUsd: input.estUsd,
      capOk: input.capOk,
      legs: input.legs,
    });
    if (!gate.ok) return { kind: "unclassified", reason: gate.reason };

    if (this.paused) return { kind: "unclassified", reason: "paused" };

    const cached = this.cache.get(input.cacheKey);
    if (cached) {
      return {
        kind: "preset",
        preset: cached.preset,
        confidence: cached.confidence,
        source: "cache",
      };
    }

    const result = await this.venice.classify(input.prompt, gate.legs);
    if (!result.ok) {
      this.noteFail();
      return { kind: "unclassified", reason: result.reason };
    }
    if (belowFloor(result.decision)) {
      return { kind: "unclassified", reason: "low confidence" };
    }
    this.consecutiveFails = 0;
    this.backoffIdx = 0;
    this.cache.set(input.cacheKey, result.decision);
    return {
      kind: "preset",
      preset: result.decision.preset,
      confidence: result.decision.confidence,
      source: "venice",
    };
  }

  private noteFail(): void {
    this.consecutiveFails += 1;
    const delay = BACKOFF_MS[Math.min(this.backoffIdx, BACKOFF_MS.length - 1)]!;
    this.backoffIdx += 1;
    if (this.consecutiveFails >= 3) {
      this.pauseUntil = Date.now() + PAUSE_AFTER_FAILURES_S * 1000;
      this.consecutiveFails = 0;
    }
    void delay;
  }
}
