/** Transport ladder — sprint 3 ships rank 1 (LAN) only. */
export type TransportRung = "lan" | "tailscale" | "cf-tunnel" | "custom-tunnel";

export const LADDER_ORDER: readonly TransportRung[] = [
  "lan",
  "tailscale",
  "cf-tunnel",
  "custom-tunnel",
] as const;

export interface ActiveRung {
  rung: TransportRung;
  rank: number;
  endpoint: string;
  pinned: boolean;
}

export function rankOf(rung: TransportRung): number {
  return LADDER_ORDER.indexOf(rung) + 1;
}

/** First working path wins; only LAN is implemented in sprint 3. */
export function selectActiveRung(
  available: Partial<Record<TransportRung, string>>,
  pin?: TransportRung,
): ActiveRung | null {
  if (pin && available[pin]) {
    return { rung: pin, rank: rankOf(pin), endpoint: available[pin]!, pinned: true };
  }
  for (const rung of LADDER_ORDER) {
    const endpoint = available[rung];
    if (endpoint) {
      return { rung, rank: rankOf(rung), endpoint, pinned: false };
    }
  }
  return null;
}
