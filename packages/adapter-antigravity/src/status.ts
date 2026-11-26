import type { IdeProbe } from "./ide.js";
import { REASON_IDE_CLOSED, type IdeClosedReason } from "./ide.js";

export type LegStatus = { enabled: true } | { enabled: false; reason: IdeClosedReason | string };

/** Resolve leg availability from an IDE probe. */
export async function probeLegStatus(probe: IdeProbe): Promise<LegStatus> {
  const running = await probe.isRunning();
  if (!running) return { enabled: false, reason: REASON_IDE_CLOSED };
  return { enabled: true };
}

/** Map status onto policy-gate candidacy fields. */
export function candidacyFlags(status: LegStatus): {
  available: boolean;
  disabledReason?: string;
} {
  if (status.enabled) return { available: true };
  return { available: false, disabledReason: status.reason };
}
