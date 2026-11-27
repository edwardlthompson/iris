/** Permission result shaped like Agent SDK canUseTool (FOSS interface only). */
export type PermissionResult =
  | { behavior: "allow"; updatedInput?: Record<string, unknown> }
  | { behavior: "deny"; message: string };

export type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  opts: { signal: AbortSignal; toolUseID: string },
) => Promise<PermissionResult>;

export type ClaudeMessage =
  | { type: "assistant"; text: string }
  | { type: "tool_use"; toolUseID: string; name: string; input: Record<string, unknown> }
  | { type: "result"; stopReason: string }
  | { type: "rate_limits"; limits: Record<string, unknown> };

export type QueryOptions = {
  canUseTool?: CanUseTool;
  resume?: string;
  /** Pool mode: override Anthropic/LiteLLM base URL (maps to ANTHROPIC_BASE_URL). */
  baseUrl?: string;
  /** When true, allow a PTY/screen path; default headless (no PTY). */
  screen?: boolean;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  /** CLI alias (`haiku`, `sonnet`, `opus`, `fable`). */
  model?: string;
};

/**
 * FOSS production boundary. Real @anthropic-ai/claude-agent-sdk is proprietary —
 * never import it here. Inject a StubClaudeRuntime (tests) or a commercial
 * wrapper living outside the FOSS path.
 */
export interface ClaudeRuntime {
  query(prompt: string, options?: QueryOptions): AsyncIterable<ClaudeMessage>;
}
