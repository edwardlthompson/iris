import { CACHE_TTL_S } from "./constants.js";

type Entry<T> = { value: T; expires: number };

/** Simple TTL cache for stage-2 decisions (prompt prefix + repo + last turns). */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs = CACHE_TTL_S * 1000) {}

  get(key: string): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expires) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}
