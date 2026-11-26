/** Appendix B1 — ordered regex table; matching weights are summed. */
export type PatternRow = {
  id: string;
  re: RegExp;
  signal: string;
  weight: number;
};

export const STAGE1_PATTERNS: PatternRow[] = [
  {
    id: "stack",
    re: /Traceback \(most recent|^\s+at .+\(.*:\d+:\d+\)|panic:/m,
    signal: "stack trace",
    weight: 2,
  },
  {
    id: "error",
    re: /Cannot find module|ModuleNotFoundError|undefined is not a function|type mismatch/,
    signal: "concrete error",
    weight: 2,
  },
  {
    id: "math",
    re: /\$\$|\bO\(n|\bamortized\b|\bproof\b|\bderivative\b/,
    signal: "math",
    weight: 2,
  },
  {
    id: "test",
    re: /\.(test|spec)\.[jt]sx?|pytest|vitest|jest/,
    signal: "test work",
    weight: 1,
  },
  {
    id: "multi",
    re: /and then|after that|followed by|also update/i,
    signal: "multi-step",
    weight: 2,
  },
  {
    id: "refactor",
    re: /rename|extract|move .* to|split .* into/i,
    signal: "refactor",
    weight: 1,
  },
  {
    id: "docs",
    re: /README|CHANGELOG|comment|docstring/,
    signal: "docs",
    weight: -1,
  },
  {
    id: "trivial",
    re: /typo|bump|version|format|lint/i,
    signal: "trivial",
    weight: -2,
  },
  {
    id: "migration",
    re: /migrat|schema change|breaking/i,
    signal: "migration",
    weight: 2,
  },
  {
    id: "explain",
    re: /\bwhy\b|\bexplain\b|how does/i,
    signal: "explanation",
    weight: -1,
  },
];
