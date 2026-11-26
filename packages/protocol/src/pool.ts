import { z } from "zod";
import { CapabilitiesSchema } from "./capabilities.js";

export const TopologySchema = z.enum(["direct", "pool"]);
export type Topology = z.infer<typeof TopologySchema>;

export const PoolAuthSchema = z
  .object({
    mode: z.enum(["pool", "byok"]),
    keyRef: z.string().min(1),
  })
  .strict();

export const PoolLimitsSchema = z
  .object({
    rpm: z.number().positive().optional(),
    monthlyCapUsd: z.number().nonnegative().optional(),
  })
  .strict();

/** Static Pool config shape (methods are runtime). */
export const PoolSchema = z
  .object({
    id: z.string().min(1),
    baseUrl: z.string().url(),
    auth: PoolAuthSchema,
    limits: PoolLimitsSchema.default({}),
  })
  .strict();

export type Pool = z.infer<typeof PoolSchema>;

export const ModelCardSchema = z
  .object({
    canonicalId: z.string().min(1),
    poolId: z.string().min(1),
    nativeId: z.string().min(1),
    ctx: z.number().int().positive(),
    priceIn: z.number().nonnegative(),
    priceOut: z.number().nonnegative(),
    capabilities: CapabilitiesSchema,
  })
  .strict();

export type ModelCard = z.infer<typeof ModelCardSchema>;
