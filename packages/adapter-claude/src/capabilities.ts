import type { Capabilities } from "@iris/protocol";

/** Iris leg flags for Claude (B6). baseUrlOverride enables pool via ANTHROPIC_BASE_URL. */
export const CLAUDE_CAPABILITIES: Capabilities = {
  headless: true,
  streaming: true,
  toolApproval: true,
  imageInput: true,
  planMode: true,
  modelSelect: true,
  effortSelect: true,
  resume: true,
  costReporting: true,
  quotaReporting: true,
  worktree: true,
  baseUrlOverride: true,
};
