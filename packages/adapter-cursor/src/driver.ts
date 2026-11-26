import type { IdeProbe } from "./ide.js";
import type { CreditProbe } from "./credits.js";
import { probeCursorLeg, type LegStatus } from "./status.js";

export type CursorBridge = {
  send(opts: {
    prompt: string;
    model: string;
    signal?: AbortSignal;
  }): Promise<{ text: string; stopReason: string }>;
};

export class CursorDriver {
  constructor(
    private readonly ide: IdeProbe,
    private readonly credits: CreditProbe,
    private readonly bridge: CursorBridge,
  ) {}

  status(): Promise<LegStatus> {
    return probeCursorLeg(this.ide, this.credits);
  }

  async run(prompt: string, signal?: AbortSignal) {
    const status = await this.status();
    if (!status.enabled) {
      throw new Error(`cursor disabled: ${status.reason}`);
    }
    const out = await this.bridge.send({ prompt, model: status.model, signal });
    return { ...out, model: status.model, status };
  }
}
