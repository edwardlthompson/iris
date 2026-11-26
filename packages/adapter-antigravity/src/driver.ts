import type { IdeProbe } from "./ide.js";
import { probeLegStatus, type LegStatus } from "./status.js";

export type IdeBridge = {
  send(prompt: string, signal?: AbortSignal): Promise<{ text: string; stopReason: string }>;
};

export type DriverResult = {
  text: string;
  stopReason: string;
  status: LegStatus;
};

/**
 * Custom driver over a running Antigravity IDE.
 * Refuses work when the IDE is closed (headless: false).
 */
export class AntigravityDriver {
  constructor(
    private readonly probe: IdeProbe,
    private readonly bridge: IdeBridge,
  ) {}

  status(): Promise<LegStatus> {
    return probeLegStatus(this.probe);
  }

  async run(prompt: string, signal?: AbortSignal): Promise<DriverResult> {
    const status = await this.status();
    if (!status.enabled) {
      throw new Error(`antigravity disabled: ${status.reason}`);
    }
    const out = await this.bridge.send(prompt, signal);
    return { ...out, status };
  }
}
