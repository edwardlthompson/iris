import { z } from "zod";

export const WizardStepSchema = z.enum(["welcome", "pair", "topology", "litellm", "done"]);
export type WizardStep = z.infer<typeof WizardStepSchema>;

export type TopologyChoice = "direct" | "pool";

export type Pairer = {
  hostFingerprint(): string;
  pair(presented: string): { ok: true; sessionId: string } | { ok: false; reason: string };
};

export type WizardState = {
  step: WizardStep;
  topology: TopologyChoice;
  includeLiteLlm: boolean;
  sessionId: string | null;
  error: string | null;
};

export function initialWizardState(): WizardState {
  return {
    step: "welcome",
    topology: "direct",
    includeLiteLlm: false,
    sessionId: null,
    error: null,
  };
}

/** Advance first-run wizard; pairing must succeed before done. */
export function advanceWizard(
  state: WizardState,
  action:
    | { type: "next" }
    | { type: "pair"; code: string; pairer: Pairer }
    | { type: "setTopology"; topology: TopologyChoice }
    | { type: "setLiteLlm"; include: boolean },
): WizardState {
  if (action.type === "setTopology") {
    return { ...state, topology: action.topology, error: null };
  }
  if (action.type === "setLiteLlm") {
    return { ...state, includeLiteLlm: action.include, error: null };
  }
  if (action.type === "pair") {
    const result = action.pairer.pair(action.code);
    if (!result.ok) {
      return { ...state, step: "pair", error: result.reason, sessionId: null };
    }
    return {
      ...state,
      step: "topology",
      sessionId: result.sessionId,
      error: null,
    };
  }
  switch (state.step) {
    case "welcome":
      return { ...state, step: "pair", error: null };
    case "pair":
      return { ...state, error: "pairing_required" };
    case "topology":
      return {
        ...state,
        step: state.topology === "pool" ? "litellm" : "done",
        error: null,
      };
    case "litellm":
      return { ...state, step: "done", error: null };
    case "done":
      return state;
  }
}

export function wizardComplete(state: WizardState): boolean {
  return state.step === "done" && Boolean(state.sessionId);
}
