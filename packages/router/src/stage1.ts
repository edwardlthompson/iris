import type { PresetId } from "@iris/protocol";
import { STAGE1_PATTERNS } from "./patterns.js";
import { applyOverrides, type OverrideInput } from "./overrides.js";

export type Stage1Result =
  | { kind: "preset"; preset: PresetId; score: number; signals: string[] }
  | { kind: "unsure"; score: number; signals: string[]; reason: string };

export type RepoSignals = {
  /** Changed file paths in the working tree / prompt context. */
  files?: string[];
  /** Unified diff text or line count of pending diff. */
  diffLines?: number;
  diffFileCount?: number;
};

export type Stage1Input = {
  prompt: string;
  repo?: RepoSignals;
  overrides?: OverrideInput;
};

function scoreToPreset(score: number): PresetId {
  if (score <= 0) return "savings";
  if (score <= 2) return "balanced";
  if (score <= 4) return "performance";
  return "max";
}

/** Stage 1 local classifier — regex weights + repo signals; may emit unsure. */
export function classifyStage1(input: Stage1Input): Stage1Result {
  const text = input.prompt ?? "";
  const files = input.repo?.files ?? [];
  const diffLines = input.repo?.diffLines ?? 0;
  const diffFiles = input.repo?.diffFileCount ?? files.length;

  const signals: string[] = [];
  let score = 0;
  let pos = 0;
  let neg = 0;

  const haystack = [text, ...files].join("\n");
  for (const row of STAGE1_PATTERNS) {
    if (row.re.test(haystack)) {
      score += row.weight;
      signals.push(row.signal);
      if (row.weight > 0) pos += row.weight;
      if (row.weight < 0) neg += row.weight;
    }
  }

  const noRepoContext = diffLines === 0 && diffFiles === 0 && files.length === 0;
  if (pos > 0 && neg < 0) {
    return { kind: "unsure", score, signals, reason: "opposing signs" };
  }
  // B1: no diff and no files → unsure when there is also nothing to score in the prompt.
  if (noRepoContext && (!text.trim() || (score === 0 && text.trim().split(/\s+/).length < 12))) {
    return {
      kind: "unsure",
      score,
      signals,
      reason: !text.trim() ? "empty prompt" : "no diff and no files",
    };
  }

  let preset = scoreToPreset(score);
  preset = applyOverrides(preset, {
    ...input.overrides,
    diffLines,
    diffFileCount: diffFiles,
    prompt: text,
    signals,
  });

  return { kind: "preset", preset, score, signals };
}
