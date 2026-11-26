/** Reconnect backoff: 250ms → 500 → 1s → 2s → 4s (cap). */
export function backoffMs(attempt: number, base = 250, cap = 4_000): number {
  const n = Math.max(0, attempt);
  return Math.min(cap, base * 2 ** n);
}
