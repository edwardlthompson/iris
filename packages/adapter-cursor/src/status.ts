import type { IdeProbe } from "./ide.js";
import { REASON_IDE_CLOSED } from "./ide.js";
import {
  bestModelWithCredits,
  creditDisableReason,
  creditsOk,
  type CreditProbe,
  type CreditSnapshot,
} from "./credits.js";

export type LegStatus =
  | { enabled: true; model: string; credits: CreditSnapshot }
  | { enabled: false; reason: string; credits?: CreditSnapshot };

export async function probeCursorLeg(ide: IdeProbe, credits: CreditProbe): Promise<LegStatus> {
  if (!(await ide.isRunning())) {
    return { enabled: false, reason: REASON_IDE_CLOSED };
  }
  const snap = await credits.snapshot();
  if (!creditsOk(snap)) {
    return { enabled: false, reason: creditDisableReason(snap)!, credits: snap };
  }
  const model = bestModelWithCredits(snap)!;
  return { enabled: true, model, credits: snap };
}

export function candidacyFlags(status: LegStatus): {
  available: boolean;
  quotaOk: boolean;
  disabledReason?: string;
  model?: string;
} {
  if (!status.enabled) {
    const ideClosed = status.reason === REASON_IDE_CLOSED;
    return {
      available: !ideClosed,
      quotaOk: status.reason !== "no_credits",
      disabledReason: status.reason,
    };
  }
  return { available: true, quotaOk: true, model: status.model };
}
