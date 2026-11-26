import { CLAUDE_CAPABILITIES } from "./capabilities.js";
import { QuotaStore } from "./quota.js";
import type { ClaudeRuntime, CanUseTool, QueryOptions } from "./runtime.js";
import type { Capabilities } from "@iris/protocol";

export type ApprovalChannel = {
  request(toolName: string, input: Record<string, unknown>, toolUseID: string): Promise<boolean>;
};

export type SessionResult = {
  texts: string[];
  stopReason: string;
  quota: ReturnType<QuotaStore["get"]>;
  baseUrlUsed: string | null;
};

export type ClaudeSessionOptions = {
  runtime: ClaudeRuntime;
  approvals?: ApprovalChannel;
  quota?: QuotaStore;
  /** Pool mode base URL → ANTHROPIC_BASE_URL for the runtime. */
  baseUrl?: string;
  resume?: string;
  screen?: boolean;
  signal?: AbortSignal;
};

/** Headless Claude session: query + canUseTool → approvals + quota statusline. */
export class ClaudeSession {
  readonly capabilities: Capabilities = CLAUDE_CAPABILITIES;
  private readonly runtime: ClaudeRuntime;
  private readonly approvals: ApprovalChannel | undefined;
  private readonly quota: QuotaStore;
  private readonly baseUrl: string | undefined;
  private readonly resume: string | undefined;
  private readonly screen: boolean;
  private readonly signal: AbortSignal | undefined;

  constructor(opts: ClaudeSessionOptions) {
    this.runtime = opts.runtime;
    this.approvals = opts.approvals;
    this.quota = opts.quota ?? new QuotaStore();
    this.baseUrl = opts.baseUrl;
    this.resume = opts.resume;
    this.screen = opts.screen ?? false;
    this.signal = opts.signal;
  }

  async run(prompt: string): Promise<SessionResult> {
    const texts: string[] = [];
    let stopReason = "end_turn";
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (this.baseUrl) env.ANTHROPIC_BASE_URL = this.baseUrl;
    const baseUrlUsed = this.baseUrl ?? env.ANTHROPIC_BASE_URL ?? null;

    const canUseTool: CanUseTool | undefined = this.approvals
      ? async (toolName, input, { toolUseID }) => {
          const ok = await this.approvals!.request(toolName, input, toolUseID);
          return ok ? { behavior: "allow" } : { behavior: "deny", message: "user rejected" };
        }
      : undefined;

    const options: QueryOptions = {
      canUseTool,
      resume: this.resume,
      baseUrl: this.baseUrl,
      screen: this.screen,
      signal: this.signal,
      env,
    };

    for await (const msg of this.runtime.query(prompt, options)) {
      if (msg.type === "assistant") texts.push(msg.text);
      else if (msg.type === "rate_limits") this.quota.record(msg.limits);
      else if (msg.type === "result") stopReason = msg.stopReason;
    }

    return { texts, stopReason, quota: this.quota.get(), baseUrlUsed };
  }
}
