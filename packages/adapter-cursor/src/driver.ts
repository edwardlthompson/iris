import type { IdeProbe } from "./ide.js";
import type { CreditProbe } from "./credits.js";
import { probeCursorLeg, type LegStatus } from "./status.js";

export type CursorBridge = {
  send(opts: {
    prompt: string;
    model: string;
    effort?: string;
    pickerLabel?: string;
    signal?: AbortSignal;
    images?: { data: string; name?: string; type?: string }[];
  }): Promise<{ text: string; stopReason: string; modelSelect?: string }>;
};

export type CursorRunOpts = {
  prompt: string;
  model?: string;
  effort?: string;
  pickerLabel?: string;
  signal?: AbortSignal;
  images?: { data: string; name?: string; type?: string }[];
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

  async run(promptOrOpts: string | CursorRunOpts, signal?: AbortSignal) {
    const opts: CursorRunOpts =
      typeof promptOrOpts === "string"
        ? { prompt: promptOrOpts, signal }
        : promptOrOpts;
    const status = await this.status();
    if (!status.enabled) {
      throw new Error(`cursor disabled: ${status.reason}`);
    }
    const model = opts.model ?? status.model;
    const out = await this.bridge.send({
      prompt: opts.prompt,
      model,
      effort: opts.effort,
      pickerLabel: opts.pickerLabel,
      signal: opts.signal ?? signal,
      images: opts.images,
    });
    return { ...out, model, status };
  }
}
