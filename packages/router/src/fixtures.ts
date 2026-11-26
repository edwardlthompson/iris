import type { Stage1Input } from "./stage1.js";
import type { PresetId } from "@iris/protocol";

export type Stage1Fixture = {
  id: string;
  input: Stage1Input;
  expect: { kind: "preset"; preset: PresetId } | { kind: "unsure" };
};

/** Appendix B5 stage-1 fixtures (subset for sprint 9). */
export const STAGE1_FIXTURES: Stage1Fixture[] = [
  {
    id: "docs-only",
    input: { prompt: "Update the README with a typo fix", repo: { files: ["README.md"] } },
    expect: { kind: "preset", preset: "savings" },
  },
  {
    id: "stack-trace",
    input: {
      prompt: "Fix this Traceback (most recent call last):\n  File app.py",
      repo: { files: ["app.py"], diffLines: 20 },
    },
    expect: { kind: "preset", preset: "balanced" },
  },
  {
    id: "stack-math",
    input: {
      prompt: "Traceback (most recent) and prove O(n) amortized bound",
      repo: { files: ["algo.ts"], diffLines: 40 },
    },
    expect: { kind: "preset", preset: "performance" },
  },
  {
    id: "multi-step-refactor",
    input: {
      prompt: "rename Foo and then extract Bar, also update callers",
      repo: { files: ["a.ts", "b.ts"], diffLines: 80 },
    },
    expect: { kind: "preset", preset: "performance" },
  },
  {
    id: "large-diff",
    input: {
      prompt: "apply these changes",
      repo: { diffLines: 900, diffFileCount: 12, files: ["a.ts"] },
    },
    expect: { kind: "preset", preset: "balanced" },
  },
  {
    id: "empty-prompt",
    input: { prompt: "", repo: {} },
    expect: { kind: "unsure" },
  },
  {
    id: "unsure-opposing",
    input: {
      prompt: "Fix Traceback (most recent) and update README",
      repo: { files: ["README.md", "app.py"], diffLines: 10 },
    },
    expect: { kind: "unsure" },
  },
  {
    id: "pin-overrides",
    input: {
      prompt: "typo in comment",
      repo: { files: ["x.ts"] },
      overrides: { pin: "max" },
    },
    expect: { kind: "preset", preset: "max" },
  },
];
