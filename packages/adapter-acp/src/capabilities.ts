import type { Capabilities } from "@iris/protocol";

/** Iris leg flags for ACP adapters (B6). baseUrlOverride enables pool mode. */
export const ACP_CAPABILITIES: Capabilities = {
  headless: true,
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
  baseUrlOverride: true,
};
