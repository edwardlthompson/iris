import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ClaudeUsageSnapshot {
  sessionLeft: number;
  weekLeft: number;
  reset5h: string | null;
  reset7d: string | null;
}

const USAGE_TTL_MS = 60_000;
let memCache: { at: number; value: ClaudeUsageSnapshot } | null = null;
let inflight: Promise<ClaudeUsageSnapshot | null> | null = null;

function credsPath(): string {
  return join(homedir(), ".claude", ".credentials.json");
}

function cacheFilePath(): string {
  const base = process.env.IRIS_HOME?.trim() || join(homedir(), ".iris");
  return join(base, "claude-usage-cache.json");
}

function readDiskCache(): ClaudeUsageSnapshot | null {
  const file = cacheFilePath();
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<ClaudeUsageSnapshot>;
    if (typeof raw.sessionLeft !== "number" || typeof raw.weekLeft !== "number") return null;
    if (!Number.isFinite(raw.sessionLeft) || !Number.isFinite(raw.weekLeft)) return null;
    return {
      sessionLeft: Math.max(0, Math.min(100, Math.round(raw.sessionLeft))),
      weekLeft: Math.max(0, Math.min(100, Math.round(raw.weekLeft))),
      reset5h: typeof raw.reset5h === "string" ? raw.reset5h : null,
      reset7d: typeof raw.reset7d === "string" ? raw.reset7d : null,
    };
  } catch {
    return null;
  }
}

function writeDiskCache(snapshot: ClaudeUsageSnapshot): void {
  const file = cacheFilePath();
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ at: Date.now(), ...snapshot }), "utf8");
  } catch {
    // Best-effort cache; never fail status snapshots on read-only filesystems.
  }
}

/** True when local Claude Code OAuth credentials exist on disk. Never returns or logs tokens. */
export function hasClaudeCredentials(): boolean {
  const file = credsPath();
  if (!existsSync(file)) return false;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      claudeAiOauth?: { accessToken?: string; refreshToken?: string };
    };
    return Boolean(raw.claudeAiOauth?.accessToken || raw.claudeAiOauth?.refreshToken);
  } catch {
    return false;
  }
}

function finiteNumber(val: unknown): number {
  if (val === null || val === undefined || val === "" || typeof val === "boolean")
    return Number.NaN;
  return Number(val);
}

/** Anthropic `/api/oauth/usage` reports `utilization` as 0..100 percent used (same scale as `limits[].percent`). */
export function leftPct(bucket: unknown, fallbackPercentUsed?: unknown): number | null {
  const fromBucket =
    bucket && typeof bucket === "object"
      ? finiteNumber((bucket as { utilization?: unknown }).utilization)
      : Number.NaN;
  const used = Number.isFinite(fromBucket) ? fromBucket : finiteNumber(fallbackPercentUsed);
  if (!Number.isFinite(used)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

export function resetIn(iso: unknown, now = Date.now()): string | null {
  if (typeof iso !== "string" || !iso) return null;
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Full";
  const mins = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export function parseClaudeUsageBody(body: unknown, now = Date.now()): ClaudeUsageSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as {
    five_hour?: { utilization?: unknown; resets_at?: unknown } | null;
    seven_day?: { utilization?: unknown; resets_at?: unknown } | null;
    limits?: Array<{ group?: unknown; percent?: unknown; resets_at?: unknown }> | null;
  };
  const limits = Array.isArray(rec.limits) ? rec.limits : [];
  const limSession = limits.find((l) => l?.group === "session");
  const limWeekly = limits.find((l) => l?.group === "weekly");
  const sessionLeft = leftPct(rec.five_hour, limSession?.percent);
  const weekLeft = leftPct(rec.seven_day, limWeekly?.percent);
  if (sessionLeft == null && weekLeft == null) return null;
  return {
    sessionLeft: sessionLeft ?? weekLeft ?? 0,
    weekLeft: weekLeft ?? sessionLeft ?? 0,
    reset5h: resetIn(rec.five_hour?.resets_at ?? limSession?.resets_at, now),
    reset7d: resetIn(rec.seven_day?.resets_at ?? limWeekly?.resets_at, now),
  };
}

async function fetchLiveClaudeUsage(): Promise<ClaudeUsageSnapshot | null> {
  const file = credsPath();
  if (!existsSync(file)) return null;
  let token = "";
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as {
      claudeAiOauth?: { accessToken?: string };
    };
    token = raw.claudeAiOauth?.accessToken ?? "";
  } catch {
    return null;
  }
  if (!token) return null;
  const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "User-Agent": "claude-code/2.1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return parseClaudeUsageBody(body);
}

/** Remaining plan allowance from Claude Code OAuth, throttled and backed by disk cache so rate-limits never drop the meter. */
export async function claudeOauthUsage(): Promise<ClaudeUsageSnapshot | null> {
  const now = Date.now();
  if (memCache && now - memCache.at < USAGE_TTL_MS) return memCache.value;
  if (!inflight) {
    inflight = fetchLiveClaudeUsage()
      .then((fresh) => {
        if (fresh) {
          memCache = { at: Date.now(), value: fresh };
          writeDiskCache(fresh);
          return fresh;
        }
        return memCache?.value ?? readDiskCache();
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}
