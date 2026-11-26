import {
  ModelCardSchema,
  PoolSchema,
  type ModelCard,
  type Pool,
  type Topology,
} from "@iris/protocol";
import { CapAccountant } from "./caps.js";
import { HealthTracker } from "./health.js";
import { generateLiteLLMConfig } from "./litellm.js";

export type RoutePick =
  | { topology: "direct"; poolId: null }
  | { topology: "pool"; poolId: string; baseUrl: string }
  | { topology: "blocked"; reason: string };

export type ChrysaorOptions = {
  topology: Topology;
  pools: Pool[];
  cards: ModelCard[];
  poolOrder?: string[];
  monthlyCapUsd?: number | null;
  perTurnCapUsd?: number | null;
  /** Injected probe; default hits baseUrl /healthz with stub always-ok for tests. */
  probe?: (pool: Pool) => Promise<boolean>;
};

/** chrysaor: topology + pool routing, health, caps, LiteLLM front config. */
export class Chrysaor {
  private readonly topology: Topology;
  private readonly pools: Map<string, Pool>;
  private readonly cards: ModelCard[];
  private readonly order: string[];
  private readonly health = new Map<string, HealthTracker>();
  private readonly caps: CapAccountant;
  private readonly probe: (pool: Pool) => Promise<boolean>;

  constructor(opts: ChrysaorOptions) {
    this.topology = opts.topology;
    this.pools = new Map(opts.pools.map((p) => [p.id, PoolSchema.parse(p)]));
    this.cards = opts.cards.map((c) => ModelCardSchema.parse(c));
    this.order = opts.poolOrder?.length ? opts.poolOrder : [...this.pools.keys()];
    this.caps = new CapAccountant(opts.monthlyCapUsd ?? null, opts.perTurnCapUsd ?? null);
    this.probe = opts.probe ?? (async () => true);
    for (const id of this.pools.keys()) this.health.set(id, new HealthTracker());
  }

  litellmYaml(): string {
    return generateLiteLLMConfig([...this.pools.values()]);
  }

  async probeAll(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [id, pool] of this.pools) {
      const ok = await this.probe(pool);
      out[id] = this.health.get(id)!.record(ok);
    }
    return out;
  }

  healthOf(poolId: string): string {
    return this.health.get(poolId)?.status ?? "unknown";
  }

  /** Map native IDs onto canonicalId; unmappable stay pool-local. */
  reconcile(nativeId: string, poolId: string): ModelCard | null {
    return (
      this.cards.find((c) => c.poolId === poolId && c.nativeId === nativeId) ??
      this.cards.find((c) => c.canonicalId === nativeId && c.poolId === poolId) ??
      null
    );
  }

  route(canonicalId: string, estUsd: number): RoutePick {
    const cap = this.caps.checkTurn(estUsd);
    if (!cap.ok) return { topology: "blocked", reason: cap.reason };

    if (this.topology === "direct") {
      return { topology: "direct", poolId: null };
    }

    for (const id of this.order) {
      const pool = this.pools.get(id);
      if (!pool) continue;
      if (this.health.get(id)?.status === "degraded") continue;
      const card = this.cards.find((c) => c.poolId === id && c.canonicalId === canonicalId);
      if (!card) continue;
      return { topology: "pool", poolId: id, baseUrl: pool.baseUrl };
    }
    return { topology: "blocked", reason: "no healthy pool for model" };
  }

  recordSpend(usd: number): void {
    this.caps.recordSpend(usd);
  }
}

/** In-memory stub pool for tests — no network, no keys. */
export function stubPool(id = "stub"): Pool {
  return {
    id,
    baseUrl: "http://127.0.0.1:4000",
    auth: { mode: "pool", keyRef: "LITELLM_STUB_KEY" },
    limits: { monthlyCapUsd: 50 },
  };
}
