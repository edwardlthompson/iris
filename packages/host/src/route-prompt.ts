import { capPreset } from "@iris/adapter-cursor";
import { classifyStage1, type Stage1Result } from "@iris/router";
import { findLadderModel, pickDownLadder, type LadderModel } from "./model-ladder.js";

export type QuotaInput = {
  cursorLeft: number | null;
  groups: Record<string, number | null>;
  claudeOn: boolean;
  antiOn: boolean;
  poolOn?: boolean;
  poolLeft?: number | null;
  poolModel?: string | null;
  poolModels?: string[];
};

const OPEN: QuotaInput = { cursorLeft: 100, groups: {}, claudeOn: true, antiOn: true };

export type PromptRoute = {
  mode: "manual" | "auto";
  preset: string | null;
  pick: LadderModel;
  stage1: Stage1Result | null;
};

/** Stage1 + Grok ladder for phone prompts (Manual bypasses classifier). */
export function routePrompt(opts: {
  text: string;
  preset?: string;
  model?: string;
  fallbackModel?: string;
  quota?: QuotaInput;
}): PromptRoute {
  const quota = opts.quota ?? OPEN;
  if (opts.preset === "manual") {
    return {
      mode: "manual",
      preset: "manual",
      pick: findLadderModel(opts.model || opts.fallbackModel || "grok-4.7:medium", quota),
      stage1: null,
    };
  }

  const named = ["savings", "balanced", "performance", "max"].includes(opts.preset ?? "")
    ? (opts.preset as string)
    : null;
  const ceiling = opts.preset === "auto" || !named ? "max" : named;
  const stage1 = classifyStage1({ prompt: opts.text });
  const suggested =
    stage1.kind === "preset" ? stage1.preset : ceiling === "max" ? "balanced" : ceiling;
  const preset = capPreset(suggested, ceiling);
  return {
    mode: "auto",
    preset,
    pick: pickDownLadder(named === "max" ? "max" : preset, quota),
    stage1,
  };
}
