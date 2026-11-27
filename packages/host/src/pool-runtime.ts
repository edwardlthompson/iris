import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  applyLockedDiff,
  execPoolTool,
  POOL_TOOLS,
  runLockedCommand,
  userContent,
  type PoolImage,
} from "./pool-tools.js";
import { homedir } from "node:os";
import { join } from "node:path";

export type PoolConfigFile = {
  enabled?: boolean;
  proxyUrl?: string;
  monthlyCapUsd?: number;
  defaultModel?: string;
  pools?: string[];
};

export type PoolStatus = {
  configured: boolean;
  connected: boolean;
  models: string[];
  defaultModel: string | null;
  remainingPct: number;
  summary: string;
  disabledReason: string | null;
};

function irisDir(): string {
  return process.env.IRIS_HOME || join(homedir(), ".iris");
}

function redact(text: string): string {
  return text.replace(/sk-[A-Za-z0-9_-]{6,}/g, "***").replace(/Bearer\s+\S+/gi, "Bearer ***");
}

export function readPoolConfig(): PoolConfigFile | null {
  const file = join(irisDir(), "pool.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PoolConfigFile;
  } catch {
    return null;
  }
}

export function readPoolMasterKey(): string {
  if (process.env.LITELLM_MASTER_KEY) return process.env.LITELLM_MASTER_KEY.trim();
  const envFile = join(irisDir(), "litellm.env");
  if (!existsSync(envFile)) return "";
  try {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^LITELLM_MASTER_KEY\s*=\s*"?([^"\r\n#]+)"?/.exec(line.trim());
      if (m?.[1]) return m[1].trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function readSpend(): { month: string; spentUsd: number } {
  const file = join(irisDir(), "pool-spend.json");
  const month = currentMonth();
  if (!existsSync(file)) return { month, spentUsd: 0 };
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { month?: string; spentUsd?: number };
    return raw.month === month && typeof raw.spentUsd === "number"
      ? { month, spentUsd: raw.spentUsd }
      : { month, spentUsd: 0 };
  } catch {
    return { month, spentUsd: 0 };
  }
}

function recordSpend(deltaUsd: number): void {
  if (!Number.isFinite(deltaUsd) || deltaUsd <= 0) return;
  const cur = readSpend();
  const next = {
    month: cur.month,
    spentUsd: Math.round((cur.spentUsd + deltaUsd) * 1_000_000) / 1_000_000,
  };
  mkdirSync(irisDir(), { recursive: true });
  writeFileSync(join(irisDir(), "pool-spend.json"), JSON.stringify(next, null, 2));
}

export async function probePoolStatus(): Promise<PoolStatus> {
  const cfg = readPoolConfig();
  if (!cfg || cfg.enabled === false) {
    return {
      configured: false,
      connected: false,
      models: [],
      defaultModel: null,
      remainingPct: 0,
      summary: "Not configured",
      disabledReason: "not_configured",
    };
  }
  const base = (cfg.proxyUrl || "http://127.0.0.1:4000").replace(/\/$/, "");
  const key = readMasterKeyOrEmpty();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(`${base}/v1/models`, {
      signal: ctrl.signal,
      headers: key ? { authorization: `Bearer ${key}` } : undefined,
    });
    if (!res.ok) {
      return {
        configured: true,
        connected: false,
        models: [],
        defaultModel: cfg.defaultModel ?? null,
        remainingPct: 0,
        summary: `LiteLLM HTTP ${res.status}`,
        disabledReason: "proxy_error",
      };
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (body.data ?? []).map((m) => m.id || "").filter(Boolean);
    const spend = readSpend();
    const cap =
      typeof cfg.monthlyCapUsd === "number" && cfg.monthlyCapUsd > 0 ? cfg.monthlyCapUsd : null;
    const rem = cap ? Math.max(0, Math.round(((cap - spend.spentUsd) / cap) * 100)) : 100;
    const def = cfg.defaultModel || models[0] || null;
    return {
      configured: true,
      connected: true,
      models,
      defaultModel: def,
      remainingPct: rem,
      summary: cap
        ? `$${spend.spentUsd.toFixed(2)} / $${cap.toFixed(0)} · ${models.length} models`
        : `${models.length} models on :4000`,
      disabledReason: rem <= 0 ? "cap_reached" : null,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      models: [],
      defaultModel: cfg.defaultModel ?? null,
      remainingPct: 0,
      summary: "LiteLLM proxy offline (:4000)",
      disabledReason: "proxy_offline",
    };
  } finally {
    clearTimeout(timer);
  }
}

function readMasterKeyOrEmpty(): string {
  return readPoolMasterKey();
}

type ToolCall = { id: string; function?: { name?: string; arguments?: string } };
type ChatMessage = {
  role: string;
  content?: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export async function runPoolTurn(
  prompt: string,
  modelId?: string,
  opts?: { images?: PoolImage[]; onApproval?: (summary: string) => Promise<boolean> },
): Promise<{ text: string; model: string; stopReason: string; steps: string[] }> {
  const cfg = readPoolConfig();
  if (!cfg || cfg.enabled === false) throw new Error("LiteLLM pool is not configured");
  const spend = readSpend();
  if (
    typeof cfg.monthlyCapUsd === "number" &&
    cfg.monthlyCapUsd > 0 &&
    spend.spentUsd >= cfg.monthlyCapUsd
  ) {
    throw new Error(`Monthly pool cap ($${cfg.monthlyCapUsd}) reached`);
  }
  const base = (cfg.proxyUrl || "http://127.0.0.1:4000").replace(/\/$/, "");
  const key = readPoolMasterKey();
  const status = await probePoolStatus();
  const rawModel = (modelId || "").replace(/^pool:/, "").trim();
  const model =
    rawModel && rawModel !== "default"
      ? rawModel
      : status.defaultModel || status.models[0] || "venice/default";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are the frontier model Iris selected. Edit the locked repo the way a coding agent does. Read a line window once, then propose_patch. A patch is applied immediately. propose_command still waits for approval. Do not read the same file twice. The final reply is one or two sentences about what changed. Do not narrate tool calls or say the patch is waiting.",
    },
    { role: "user", content: userContent(prompt, opts?.images) },
  ];
  const steps: string[] = [];
  let imageNote = "";
  let lastModel = model;
  let tools = true;
  const seenReads = new Set<string>();
  let nudged = false;
  let patchRetry = false;
  for (let step = 0; step < 8; step += 1) {
    let res = await postPool(base, key, model, messages, tools);
    if (!res.ok && res.status === 400 && tools) {
      tools = false;
      res = await postPool(base, key, model, messages, false);
    }
    if (!res.ok && res.status === 400 && opts?.images?.length && step === 0) {
      messages[1] = { role: "user", content: prompt };
      imageNote = "This model does not accept images.";
      res = await postPool(base, key, model, messages, true);
    }
    if (!res.ok) {
      const errBody = redact(await res.text().catch(() => ""));
      throw new Error(`LiteLLM pool error (${res.status}): ${errBody.slice(0, 240)}`);
    }
    const costHdr = Number(res.headers.get("x-litellm-response-cost") || "0");
    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: ChatMessage & { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const est =
      costHdr > 0
        ? costHdr
        : ((json.usage?.prompt_tokens ?? 0) + (json.usage?.completion_tokens ?? 0)) * 0.000002;
    recordSpend(est > 0 ? est : 0.0005);
    lastModel = json.model || model;
    const message = json.choices?.[0]?.message;
    const calls = message?.tool_calls || [];
    if (!calls.length) {
      const failed = steps.some((s) => s.startsWith("propose_patch: Patch failed"));
      if (failed && !patchRetry) {
        patchRetry = true;
        messages.push({
          role: "user",
          content:
            "The patch failed. Call propose_patch once with a corrected unified diff. Do not explain.",
        });
        step -= 1;
        continue;
      }
      const text = (typeof message?.content === "string" ? message.content : "").trim();
      return {
        text: [text || "(empty reply)", imageNote].filter(Boolean).join("\n"),
        model: lastModel,
        stopReason: "end_turn",
        steps,
      };
    }
    messages.push({ role: "assistant", content: message?.content ?? "", tool_calls: calls });
    for (const call of calls) {
      const name = call.function?.name || "";
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}") as Record<string, string>;
      } catch {
        /* empty args */
      }
      let result = "";
      if (name === "read_file") {
        const key = `${args.path || ""}|${args.start || ""}`;
        if (seenReads.has(key)) {
          result = "Already shown. Call propose_patch. Do not read this file again.";
        } else {
          seenReads.add(key);
          result = await execPoolTool(name, args);
        }
        steps.push(`${name}: ${String(args.path || "").slice(0, 120)}`);
      } else if (name === "propose_patch") {
        result = await applyLockedDiff(String(args.diff || ""));
        steps.push(`${name}: ${result.split("\n")[0]}`);
      } else if (name === "propose_command") {
        const summary = `Run ${args.command}`;
        const allowed = opts?.onApproval ? await opts.onApproval(summary) : false;
        result = !allowed ? "Denied" : await runLockedCommand(String(args.command || ""));
        steps.push(`${name}: ${result.split("\n")[0]}`);
      } else {
        result = await execPoolTool(name, args);
        steps.push(`${name}: ${String(args.path || "").slice(0, 120)}`);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result.slice(0, 20000) });
    }
    if (!nudged && seenReads.size > 0 && !steps.some((s) => s.startsWith("propose_patch"))) {
      nudged = true;
      messages.push({
        role: "user",
        content:
          "You have the lines. Call propose_patch now with a unified diff. Do not read again.",
      });
    }
  }
  return {
    text: ["Could not finish that edit. No patch was applied.", imageNote]
      .filter(Boolean)
      .join("\n"),
    model: lastModel,
    stopReason: "end_turn",
    steps,
  };
}

async function postPool(
  base: string,
  key: string,
  model: string,
  messages: ChatMessage[],
  tools: boolean,
): Promise<Response> {
  return fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model, messages, ...(tools ? { tools: POOL_TOOLS } : {}) }),
  });
}
