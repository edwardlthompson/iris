import type { PresetId } from "@iris/protocol";

/** B8 preset policies (CursorBench-labelled defaults). */
export type PresetPolicy = {
  class: "cheap" | "mid" | "frontier";
  default: string;
  effort_start: string;
  effort_ceiling: string;
  steps: number;
  escalate: string;
  cap_usd?: number;
  warn_usd?: number;
  hard_cap_usd?: number;
  on_cap: string;
};

export const PRESET_POLICIES: Record<PresetId, PresetPolicy> = {
  savings: {
    class: "cheap",
    default: "claude-haiku-5-5",
    effort_start: "low",
    effort_ceiling: "medium",
    steps: 25,
    escalate: "never",
    cap_usd: 0.1,
    on_cap: "stop_and_ask",
  },
  balanced: {
    class: "mid",
    default: "claude-sonnet-5-5",
    effort_start: "medium",
    effort_ceiling: "high",
    steps: 40,
    escalate: "on_2_fails",
    cap_usd: 0.6,
    on_cap: "escalate_or_ask",
  },
  performance: {
    class: "frontier",
    default: "claude-opus-5-5",
    effort_start: "high",
    effort_ceiling: "xhigh",
    steps: 80,
    escalate: "on_2_fails",
    cap_usd: 4.0,
    on_cap: "escalate",
  },
  max: {
    class: "frontier",
    default: "claude-fable-5-2",
    effort_start: "high",
    effort_ceiling: "max",
    steps: 200,
    escalate: "on_1_fail",
    warn_usd: 20,
    hard_cap_usd: 50,
    on_cap: "finish_turn_then_stop",
  },
};

export const BENCHMARK_REF = "ref. CursorBench";
