import type { HandoffV1 } from "@iris/protocol";

export type ResumePlan = {
  threadId: string;
  leg: string;
  model: string;
  goal: string;
  state: HandoffV1["state"];
  constraints: string[];
  /** Always the handoff next_step — resume at next turn boundary. */
  nextStep: string;
  budget: HandoffV1["budget"];
};

/** Build a resume plan from a handoff after the host was killed. */
export function planResume(handoff: HandoffV1): ResumePlan {
  return {
    threadId: handoff.thread_id,
    leg: handoff.to.leg,
    model: handoff.to.model,
    goal: handoff.goal,
    state: handoff.state,
    constraints: handoff.constraints,
    nextStep: handoff.next_step,
    budget: handoff.budget,
  };
}
