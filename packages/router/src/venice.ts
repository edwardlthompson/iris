import { z } from "zod";
import type { PresetId } from "@iris/protocol";
import { CONFIDENCE_FLOOR, STAGE2_TIMEOUT_MS } from "./constants.js";

export const VeniceDecisionSchema = z
  .object({
    preset: z.enum(["savings", "balanced", "performance", "max"]),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional(),
  })
  .strict();

export type VeniceDecision = z.infer<typeof VeniceDecisionSchema>;

export type VeniceClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type VeniceResult =
  | { ok: true; decision: VeniceDecision; cached?: boolean }
  | { ok: false; reason: "timeout" | "malformed" | "http" | "paused"; detail?: string };

/** OpenAI-compatible Venice classifier — FOSS HTTP only, no proprietary SDK. */
export class VeniceClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private failures = 0;
  private pauseUntil = 0;

  constructor(opts: VeniceClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.venice.ai/api/v1").replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? STAGE2_TIMEOUT_MS;
  }

  get isPaused(): boolean {
    return Date.now() < this.pauseUntil;
  }

  async classify(prompt: string, legs: string[]): Promise<VeniceResult> {
    if (this.isPaused) return { ok: false, reason: "paused" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: "clef",
          messages: [
            {
              role: "system",
              content: `Classify coding prompts. Legs: ${legs.join(",")}. JSON only.`,
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        this.noteFail();
        return { ok: false, reason: "http", detail: String(res.status) };
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = body.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        this.noteFail();
        return { ok: false, reason: "malformed" };
      }
      const decision = VeniceDecisionSchema.safeParse(parsed);
      if (!decision.success) {
        this.noteFail();
        return { ok: false, reason: "malformed" };
      }
      this.failures = 0;
      return { ok: true, decision: decision.data };
    } catch (err) {
      this.noteFail();
      const name = err instanceof Error ? err.name : "";
      return { ok: false, reason: name === "AbortError" ? "timeout" : "http" };
    } finally {
      clearTimeout(timer);
    }
  }

  private noteFail(): void {
    this.failures += 1;
    if (this.failures >= 3) {
      this.pauseUntil = Date.now() + 300_000;
      this.failures = 0;
    }
  }
}

export function belowFloor(d: VeniceDecision): boolean {
  return d.confidence < CONFIDENCE_FLOOR;
}

export type { PresetId };
