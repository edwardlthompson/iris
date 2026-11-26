import { z } from "zod";
import { PresetIdSchema } from "./ledger.js";
import { TopologySchema } from "./pool.js";

const PresetPolicySchema = z
  .object({
    class: z.enum(["cheap", "mid", "frontier"]),
    default: z.string().min(1),
    effort_start: z.string().min(1),
    effort_ceiling: z.string().min(1),
    steps: z.number().int().positive(),
    escalate: z.string().min(1),
    cap_usd: z.number().nonnegative().optional(),
    warn_usd: z.number().nonnegative().optional(),
    hard_cap_usd: z.number().nonnegative().optional(),
    on_cap: z.string().min(1),
  })
  .strict();

export const RepoConfigSchema = z
  .object({
    repo_id: z.string().min(1),
    topology: TopologySchema.default("direct"),
    legs: z.array(z.string().min(1)).min(1),
    poolOrder: z.array(z.string().min(1)).default([]),
    monthlyCapUsd: z.number().nonnegative().nullable().default(null),
    presets: z.record(PresetIdSchema, PresetPolicySchema),
  })
  .strict();

export type RepoConfig = z.infer<typeof RepoConfigSchema>;
