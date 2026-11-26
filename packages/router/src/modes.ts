import { z } from "zod";

export const RoutingModeSchema = z.enum(["off", "suggest", "auto", "shadow"]);
export type RoutingMode = z.infer<typeof RoutingModeSchema>;

/** B7: 20 shadow prompts before `auto` is offered. */
export const SHADOW_GATE = 20;

export type ModeState = {
  mode: RoutingMode;
  shadowCompletions: number;
};

export function initialModeState(mode: RoutingMode = "suggest"): ModeState {
  return { mode, shadowCompletions: 0 };
}

export function recordShadowPrompt(state: ModeState): ModeState {
  if (state.mode !== "shadow") return state;
  return { ...state, shadowCompletions: state.shadowCompletions + 1 };
}

/** Auto is offered only after SHADOW_GATE paired shadow prompts. */
export function canOfferAuto(state: ModeState): boolean {
  return state.shadowCompletions >= SHADOW_GATE;
}

export function setMode(state: ModeState, mode: RoutingMode): ModeState | { error: string } {
  if (mode === "auto" && !canOfferAuto(state)) {
    return { error: "shadow_gate" };
  }
  return { ...state, mode };
}
