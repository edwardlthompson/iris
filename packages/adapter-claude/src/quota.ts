import { z } from "zod";

export const RateLimitsSchema = z
  .object({
    inputTokensRemaining: z.number().nonnegative().optional(),
    outputTokensRemaining: z.number().nonnegative().optional(),
    resetsAt: z.string().datetime().optional(),
  })
  .strict();

export type RateLimits = z.infer<typeof RateLimitsSchema>;

/** In-memory quota store fed by statusline rate_limits. */
export class QuotaStore {
  private latest: RateLimits | null = null;

  record(raw: unknown): RateLimits {
    const parsed = RateLimitsSchema.parse(raw);
    this.latest = parsed;
    return parsed;
  }

  get(): RateLimits | null {
    return this.latest;
  }

  clear(): void {
    this.latest = null;
  }
}
