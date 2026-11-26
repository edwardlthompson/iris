export type PoolHealth = "healthy" | "degraded";

/** Two consecutive probe failures → degraded; success recovers. */
export class HealthTracker {
  private fails = 0;
  private state: PoolHealth = "healthy";

  get status(): PoolHealth {
    return this.state;
  }

  record(ok: boolean): PoolHealth {
    if (ok) {
      this.fails = 0;
      this.state = "healthy";
    } else {
      this.fails += 1;
      if (this.fails >= 2) this.state = "degraded";
    }
    return this.state;
  }
}
