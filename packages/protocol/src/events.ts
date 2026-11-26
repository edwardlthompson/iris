import { z } from "zod";
import { HandoffV1Schema } from "./handoff.js";
import { PresetIdSchema } from "./ledger.js";
import { TopologySchema } from "./pool.js";

const EnvelopeBase = z.object({
  v: z.literal(1),
  seq: z.number().int().nonnegative(),
  ts: z.string().datetime(),
});

export const ThreadOpenSchema = EnvelopeBase.extend({
  type: z.literal("thread.open"),
  thread_id: z.string().min(1),
  repo_id: z.string().min(1),
}).strict();

export const UserPromptSchema = EnvelopeBase.extend({
  type: z.literal("user.prompt"),
  text: z.string(),
}).strict();

export const RouteEventSchema = EnvelopeBase.extend({
  type: z.literal("route"),
  leg: z.string().min(1),
  model: z.string().min(1),
  effort: z.string().min(1),
  preset: PresetIdSchema,
  est_usd: z.number().nonnegative(),
  topology: TopologySchema,
  pool_id: z.string().min(1).nullable(),
}).strict();

export const ToolCallSchema = EnvelopeBase.extend({
  type: z.literal("tool.call"),
  tool: z.string().min(1),
  input: z.unknown(),
  approval: z.enum(["pending", "allowed", "denied"]).optional(),
}).strict();

export const AgentTextSchema = EnvelopeBase.extend({
  type: z.literal("agent.text"),
  text: z.string(),
}).strict();

export const EscalateSchema = EnvelopeBase.extend({
  type: z.literal("escalate"),
  from_preset: PresetIdSchema,
  to_preset: PresetIdSchema,
  reason: z.string().min(1),
}).strict();

export const HandoffEventSchema = EnvelopeBase.extend({
  type: z.literal("handoff"),
  handoff: HandoffV1Schema,
}).strict();

export const ThreadCloseSchema = EnvelopeBase.extend({
  type: z.literal("thread.close"),
  outcome: z.enum(["pass", "fail", "abandoned", "user_override"]),
}).strict();

export const ThreadEventSchema = z.discriminatedUnion("type", [
  ThreadOpenSchema,
  UserPromptSchema,
  RouteEventSchema,
  ToolCallSchema,
  AgentTextSchema,
  EscalateSchema,
  HandoffEventSchema,
  ThreadCloseSchema,
]);

export type ThreadEvent = z.infer<typeof ThreadEventSchema>;
