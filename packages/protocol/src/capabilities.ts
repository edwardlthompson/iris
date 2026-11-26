import { z } from "zod";

/** Leg capability flags (Appendix C / B6). */
export const CapabilitiesSchema = z
  .object({
    headless: z.boolean(),
    streaming: z.boolean(),
    toolApproval: z.boolean(),
    imageInput: z.boolean(),
    planMode: z.boolean(),
    modelSelect: z.boolean(),
    effortSelect: z.boolean(),
    resume: z.boolean(),
    costReporting: z.boolean(),
    quotaReporting: z.boolean(),
    worktree: z.boolean(),
    baseUrlOverride: z.boolean(),
  })
  .strict();

export type Capabilities = z.infer<typeof CapabilitiesSchema>;
