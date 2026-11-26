import type { Capabilities } from "@iris/protocol";

/** Cursor IDE bridge — desktop app required (B6). CLI/ACP may also attach. */
export const CURSOR_CAPABILITIES: Capabilities = {
  headless: false,
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
  baseUrlOverride: false,
};
