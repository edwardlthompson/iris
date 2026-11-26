import type { RoutingMode } from "./modes.js";
import { canOfferAuto, type ModeState } from "./modes.js";

export type AutoBadge = {
  visible: boolean;
  label: "auto" | "suggest" | "shadow" | "off";
  offerAuto: boolean;
  overrideNote: string | null;
  escalationNote: string | null;
};

export function buildBadge(opts: {
  state: ModeState;
  overrideNote?: string | null;
  escalationNote?: string | null;
}): AutoBadge {
  const offerAuto = canOfferAuto(opts.state);
  return {
    visible: opts.state.mode !== "off",
    label: opts.state.mode,
    offerAuto,
    overrideNote: opts.overrideNote ?? null,
    escalationNote: opts.escalationNote ?? null,
  };
}

export function modeAllowsAutoRoute(mode: RoutingMode): boolean {
  return mode === "auto";
}
