import type { ClaudeMessage, ClaudeRuntime, QueryOptions } from "./runtime.js";

export type StubScript = {
  /** Prompt substring that triggers a tool approval before finishing. */
  toolName?: string;
  toolInput?: Record<string, unknown>;
  assistantText?: string;
  rateLimits?: Record<string, unknown>;
  /** Echo the effective base URL into an assistant message for tests. */
  echoBaseUrl?: boolean;
};

/** Headless FOSS fixture — no PTY, no proprietary SDK. */
export class StubClaudeRuntime implements ClaudeRuntime {
  constructor(private readonly script: StubScript = {}) {}

  async *query(prompt: string, options: QueryOptions = {}): AsyncIterable<ClaudeMessage> {
    if (options.screen) {
      throw new Error("StubClaudeRuntime refuses PTY; screen flag is for a commercial wrapper");
    }
    const base =
      options.baseUrl ?? options.env?.ANTHROPIC_BASE_URL ?? process.env.ANTHROPIC_BASE_URL ?? null;

    if (this.script.rateLimits) {
      yield { type: "rate_limits", limits: this.script.rateLimits };
    }

    const text =
      this.script.assistantText ??
      (this.script.echoBaseUrl ? `base=${base ?? "default"}` : `echo:${prompt}`);
    yield { type: "assistant", text };

    if (this.script.toolName && options.canUseTool) {
      const toolUseID = "tool_stub_1";
      const input = this.script.toolInput ?? { cmd: "true" };
      yield { type: "tool_use", toolUseID, name: this.script.toolName, input };
      const decision = await options.canUseTool(this.script.toolName, input, {
        signal: options.signal ?? new AbortController().signal,
        toolUseID,
      });
      if (decision.behavior === "deny") {
        yield { type: "result", stopReason: "permission_denied" };
        return;
      }
      yield { type: "assistant", text: `ran:${this.script.toolName}` };
    }

    if (options.signal?.aborted) {
      yield { type: "result", stopReason: "cancelled" };
      return;
    }
    yield { type: "result", stopReason: options.resume ? "resumed_end" : "end_turn" };
  }
}
