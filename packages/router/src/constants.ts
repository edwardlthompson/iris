/** Appendix B3 thresholds used by stage 2 + gate. */
export const CONFIDENCE_FLOOR = 0.6;
export const STAGE2_TIMEOUT_MS = 400;
export const CACHE_TTL_S = 900;
export const BACKOFF_MS = [1000, 4000, 15_000] as const;
export const PAUSE_AFTER_FAILURES_S = 300;
export const ESCALATE_AFTER_FAILS = 2;
