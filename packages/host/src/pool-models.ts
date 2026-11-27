import type { LadderModel } from "./model-ladder.js";

type Spec = { level: LadderModel["level"]; rank: number; score: number; label: string };

const FRONTIER_SPECS: Record<string, Spec> = {
  "venice/claude-fable-5-2": {
    level: "max",
    rank: 69,
    score: 60,
    label: "Venice · Claude Fable 5.2",
  },
  "venice/claude-opus-5-5": {
    level: "max",
    rank: 68,
    score: 56,
    label: "Venice · Claude Opus 5.5",
  },
  "venice/claude-opus-5-5-fast": {
    level: "performance",
    rank: 67,
    score: 55.5,
    label: "Venice · Claude Opus 5.5 Fast",
  },
  "venice/claude-sonnet-5-5": {
    level: "balanced",
    rank: 66,
    score: 53.1,
    label: "Venice · Claude Sonnet 5.5",
  },
  "venice/claude-haiku-5-5": {
    level: "savings",
    rank: 64,
    score: 48.4,
    label: "Venice · Claude Haiku 5.5",
  },
  "venice/openai-gpt-62-astra-pro": {
    level: "max",
    rank: 65,
    score: 57,
    label: "Venice · GPT-6.2 Astra Pro",
  },
  "venice/openai-gpt-62-sol-pro": {
    level: "max",
    rank: 64,
    score: 56,
    label: "Venice · GPT-6.2 Sol Pro",
  },
  "venice/openai-gpt-53-codex": {
    level: "performance",
    rank: 63,
    score: 54,
    label: "Venice · GPT-5.3 Codex",
  },
  "venice/grok-4-20": { level: "performance", rank: 62, score: 52, label: "Venice · Grok 4.20" },
  "venice/grok-4-7": { level: "performance", rank: 61, score: 50, label: "Venice · Grok 4.7" },
  "venice/gemini-4-neon": {
    level: "performance",
    rank: 61,
    score: 51,
    label: "Venice · Gemini 4 Neon",
  },
  "venice/gemini-4-carbon": {
    level: "balanced",
    rank: 60,
    score: 49,
    label: "Venice · Gemini 4 Carbon",
  },
  "venice/gemini-3-8-flash": {
    level: "savings",
    rank: 58,
    score: 45,
    label: "Venice · Gemini 3.8 Flash",
  },
  "venice/deepseek-v4-pro": {
    level: "performance",
    rank: 62,
    score: 52,
    label: "Venice · DeepSeek V4 Pro",
  },
  "venice/deepseek-v4-1-flash": {
    level: "balanced",
    rank: 59,
    score: 47,
    label: "Venice · DeepSeek V4.1 Flash",
  },
  "venice/qwen-4-max": { level: "performance", rank: 61, score: 51, label: "Venice · Qwen 4 Max" },
  "venice/qwen3-coder-480b-a35b-instruct-turbo": {
    level: "balanced",
    rank: 60,
    score: 49,
    label: "Venice · Qwen 3 Coder 480B",
  },
  "venice/kimi-k3-1-pro": {
    level: "performance",
    rank: 59,
    score: 48,
    label: "Venice · Kimi K3.1 Pro",
  },
  "venice/z-ai-glm-5-3": { level: "balanced", rank: 58, score: 47, label: "Venice · GLM 5.3" },
  "venice/nvidia-nemotron-3-ultra-550b-a55b": {
    level: "performance",
    rank: 57,
    score: 46,
    label: "Venice · Nemotron 3 Ultra",
  },
  "venice/llama-3.3-70b": {
    level: "savings",
    rank: 55,
    score: 42,
    label: "Venice · Llama 3.3 70B",
  },
};

export function formatPoolLabel(modelId: string): string {
  const clean = modelId.replace(/^pool:/, "").trim();
  if (FRONTIER_SPECS[clean]) return FRONTIER_SPECS[clean].label;
  if (clean.startsWith("venice/")) return `Venice · ${clean.slice(7)}`;
  if (clean.startsWith("openrouter/")) return `OpenRouter · ${clean.slice(11)}`;
  return `LiteLLM Pool · ${clean}`;
}

function inferSpec(id: string): Spec {
  if (FRONTIER_SPECS[id]) return FRONTIER_SPECS[id];
  const low = id.toLowerCase();
  const level: LadderModel["level"] = /opus|fable|ultra|pro|max|astra|terra/.test(low)
    ? "performance"
    : /flash|mini|nano|lite|haiku|3b|7b/.test(low)
      ? "savings"
      : "balanced";
  return { level, rank: 50, score: 44, label: formatPoolLabel(id) };
}

export function buildPoolLadderModels(opts: {
  poolModels?: string[];
  defaultModel?: string | null;
  remainingPct: number;
}): LadderModel[] {
  const raw = (opts.poolModels ?? []).filter((m) => m && !m.endsWith("/*"));
  const list = raw.length ? Array.from(new Set(raw)) : opts.defaultModel ? [opts.defaultModel] : [];
  if (opts.defaultModel && !list.includes(opts.defaultModel)) list.unshift(opts.defaultModel);

  return list.map((m) => {
    const spec = inferSpec(m);
    const isDef = opts.defaultModel === m;
    return {
      id: `pool:${m}`,
      leg: "pool" as const,
      level: spec.level,
      rank: isDef ? Math.max(spec.rank, 65) : spec.rank,
      label: spec.label,
      quota: "pool",
      score: spec.score,
      remainingPct: opts.remainingPct,
    };
  });
}
