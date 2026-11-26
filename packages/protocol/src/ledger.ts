import { z } from "zod";
import { TopologySchema } from "./pool.js";

export const PresetIdSchema = z.enum(["savings", "balanced", "performance", "max"]);
export type PresetId = z.infer<typeof PresetIdSchema>;

export const LedgerOutcomeSchema = z.enum(["pass", "fail", "abandoned", "user_override"]);
export type LedgerOutcome = z.infer<typeof LedgerOutcomeSchema>;

export const LedgerRowSchema = z
  .object({
    thread_id: z.string().min(1),
    seq: z.number().int().nonnegative(),
    repo_id: z.string().min(1),
    vendor: z.string().min(1),
    model: z.string().min(1),
    preset: PresetIdSchema,
    domain: z.string().min(1),
    topology: TopologySchema,
    pool_id: z.string().min(1).nullable(),
    stage: z.enum(["1", "2", "override", "unclassified"]),
    confidence: z.number().min(0).max(1),
    est_usd: z.number().nonnegative(),
    real_usd: z.number().nonnegative().nullable(),
    est_tok: z.number().int().nonnegative(),
    real_tok: z.number().int().nonnegative().nullable(),
    escalations: z.number().int().nonnegative(),
    rework_count: z.number().int().nonnegative(),
    outcome: LedgerOutcomeSchema,
    shadow: z.boolean(),
  })
  .strict();

export type LedgerRow = z.infer<typeof LedgerRowSchema>;
