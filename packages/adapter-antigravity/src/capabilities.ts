import type { Capabilities } from "@iris/protocol";

/** Antigravity needs the desktop IDE running (B6 / Sprint 14). */
export const ANTIGRAVITY_CAPABILITIES: Capabilities = {
  headless: false,
  streaming: true,
  toolApproval: true,
  imageInput: false,
  planMode: true,
  modelSelect: true,
  effortSelect: false,
  resume: true,
  costReporting: false,
  quotaReporting: false,
  worktree: false,
  baseUrlOverride: false,
};
