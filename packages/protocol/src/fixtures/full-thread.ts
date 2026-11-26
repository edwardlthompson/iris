import type { ThreadEvent } from "../events.js";
import type { HandoffV1 } from "../handoff.js";
import type { LedgerRow } from "../ledger.js";
import type { ModelCard } from "../pool.js";
import type { Provenance } from "../provenance.js";
import type { RepoConfig } from "../repo-config.js";
import type { Capabilities } from "../capabilities.js";

export const capsAll: Capabilities = {
  headless: true,
  streaming: true,
  toolApproval: true,
  imageInput: false,
  planMode: true,
  modelSelect: true,
  effortSelect: true,
  resume: true,
  costReporting: true,
  quotaReporting: true,
  worktree: false,
  baseUrlOverride: true,
};

export const sampleModelCard: ModelCard = {
  canonicalId: "claude-sonnet-5-5",
  poolId: "venice",
  nativeId: "claude-sonnet-5-5",
  ctx: 200000,
  priceIn: 3,
  priceOut: 15,
  capabilities: capsAll,
};

export const sampleProvenance: Provenance = {
  v: 1,
  source: "https://llmleaderboard.com/benchmarks/cursorbench",
  source_kind: "html",
  fetched_at: "2026-11-25T00:00:00.000Z",
  body_sha256: "a".repeat(64),
  row_count: 76,
  track: "4.0",
  confirmed_by: null,
  confirmed_at: null,
};

export const sampleRepoConfig: RepoConfig = {
  repo_id: "iris",
  topology: "direct",
  legs: ["claude"],
  poolOrder: [],
  monthlyCapUsd: null,
  presets: {
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
      cap_usd: 4,
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
  },
};

export const sampleHandoff: HandoffV1 = {
  v: 1,
  thread_id: "thr_1",
  from: { leg: "claude", model: "claude-sonnet-5-5" },
  to: { leg: "claude", model: "claude-haiku-5-5" },
  reason: "quota_exhausted",
  goal: "Finish the protocol schemas",
  state: {
    files_touched: ["packages/protocol/src/events.ts"],
    tests: "pending",
    last_error: null,
  },
  constraints: ["no network"],
  next_step: "Write rejection tests",
  budget: { preset: "balanced", cap_usd: 0.6 },
};

export const sampleLedger: LedgerRow = {
  thread_id: "thr_1",
  seq: 3,
  repo_id: "iris",
  vendor: "anthropic",
  model: "claude-sonnet-5-5",
  preset: "balanced",
  domain: "protocol",
  topology: "direct",
  pool_id: null,
  stage: "1",
  confidence: 0.82,
  est_usd: 0.12,
  real_usd: 0.09,
  est_tok: 4000,
  real_tok: 3200,
  escalations: 0,
  rework_count: 0,
  outcome: "pass",
  shadow: false,
};

/** Full-thread fixture: open → prompt → route → tool → text → close. */
export const fullThreadEvents: ThreadEvent[] = [
  {
    v: 1,
    seq: 0,
    ts: "2026-11-25T20:00:00.000Z",
    type: "thread.open",
    thread_id: "thr_1",
    repo_id: "iris",
  },
  {
    v: 1,
    seq: 1,
    ts: "2026-11-25T20:00:01.000Z",
    type: "user.prompt",
    text: "Add zod schemas for thread events",
  },
  {
    v: 1,
    seq: 2,
    ts: "2026-11-25T20:00:01.100Z",
    type: "route",
    leg: "claude",
    model: "claude-sonnet-5-5",
    effort: "medium",
    preset: "balanced",
    est_usd: 0.12,
    topology: "direct",
    pool_id: null,
  },
  {
    v: 1,
    seq: 3,
    ts: "2026-11-25T20:00:05.000Z",
    type: "tool.call",
    tool: "Write",
    input: { path: "packages/protocol/src/events.ts" },
    approval: "allowed",
  },
  {
    v: 1,
    seq: 4,
    ts: "2026-11-25T20:00:10.000Z",
    type: "agent.text",
    text: "Schemas added.",
  },
  {
    v: 1,
    seq: 5,
    ts: "2026-11-25T20:00:11.000Z",
    type: "thread.close",
    outcome: "pass",
  },
];
