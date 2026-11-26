import type { Capabilities } from "@iris/protocol";
import { ANTIGRAVITY_CAPABILITIES } from "./capabilities.js";
import { AntigravityDriver } from "./driver.js";
import { candidacyFlags, type LegStatus } from "./status.js";

export type SessionResult = {
  texts: string[];
  stopReason: string;
  legStatus: LegStatus;
};

export type AntigravitySessionOptions = {
  driver: AntigravityDriver;
  signal?: AbortSignal;
};

/** Non-headless session: probe IDE, then drive when enabled. */
export class AntigravitySession {
  readonly capabilities: Capabilities = ANTIGRAVITY_CAPABILITIES;
  private readonly driver: AntigravityDriver;
  private readonly signal: AbortSignal | undefined;

  constructor(opts: AntigravitySessionOptions) {
    this.driver = opts.driver;
    this.signal = opts.signal;
  }

  async legStatus(): Promise<LegStatus> {
    return this.driver.status();
  }

  async candidacy(): Promise<{ available: boolean; disabledReason?: string }> {
    return candidacyFlags(await this.legStatus());
  }

  async run(prompt: string): Promise<SessionResult> {
    const result = await this.driver.run(prompt, this.signal);
    return {
      texts: [result.text],
      stopReason: result.stopReason,
      legStatus: result.status,
    };
  }
}
