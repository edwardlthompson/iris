import { z } from "zod";

/** Process limits from docs/BUILD_PLAN.md B3. */
export const HostConfigSchema = z
  .object({
    maxConcurrent: z.number().int().positive().default(4),
    idleTtlMs: z.number().int().positive().default(90_000),
    dataDir: z.string().min(1).default(".iris"),
  })
  .strict();

export type HostConfig = z.infer<typeof HostConfigSchema>;

export function loadConfig(partial: Partial<HostConfig> = {}): HostConfig {
  return HostConfigSchema.parse(partial);
}
