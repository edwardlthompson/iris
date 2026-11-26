import { z } from "zod";
import { PresetIdSchema } from "./ledger.js";

const LegModelSchema = z
  .object({
    leg: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();

const HandoffStateSchema = z
  .object({
    files_touched: z.array(z.string()),
    tests: z.string(),
    last_error: z.string().nullable(),
  })
  .strict();

const HandoffBudgetSchema = z
  .object({
    preset: PresetIdSchema,
    cap_usd: z.number().nonnegative(),
  })
  .strict();

export const HandoffV1Schema = z
  .object({
    v: z.literal(1),
    thread_id: z.string().min(1),
    from: LegModelSchema,
    to: LegModelSchema,
    reason: z.string().min(1),
    goal: z.string().min(1),
    state: HandoffStateSchema,
    constraints: z.array(z.string()),
    next_step: z.string().min(1),
    budget: HandoffBudgetSchema,
  })
  .strict();

export type HandoffV1 = z.infer<typeof HandoffV1Schema>;
