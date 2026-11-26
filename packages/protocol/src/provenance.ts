import { z } from "zod";

export const ProvenanceSchema = z
  .object({
    v: z.literal(1),
    source: z.string().min(1),
    source_kind: z.enum(["html", "api", "manual", "fixture"]),
    fetched_at: z.string().datetime(),
    body_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    row_count: z.number().int().nonnegative(),
    track: z.string().min(1),
    confirmed_by: z.string().min(1).nullable(),
    confirmed_at: z.string().datetime().nullable(),
  })
  .strict();

export type Provenance = z.infer<typeof ProvenanceSchema>;
