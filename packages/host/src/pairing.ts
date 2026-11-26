import { fingerprint, type HostKeypair } from "./keys.js";
import type { Logger } from "./logger.js";

export type PairResult =
  | { ok: true; sessionId: string; fingerprint: string }
  | { ok: false; reason: "fingerprint_mismatch" };

export interface PairingSession {
  sessionId: string;
  fingerprint: string;
  pairedAt: string;
}

/** In-memory pairing state — transport comes in sprint 3. */
export class PairingService {
  #paired: PairingSession | null = null;

  constructor(
    private readonly keypair: HostKeypair,
    private readonly log: Logger,
  ) {}

  hostFingerprint(): string {
    return fingerprint(this.keypair.publicKey);
  }

  /** Phone presents the six-digit code shown on the host. */
  pair(presented: string): PairResult {
    const expected = this.hostFingerprint();
    if (presented !== expected) {
      this.log.warn("pairing refused", { reason: "fingerprint_mismatch" });
      return { ok: false, reason: "fingerprint_mismatch" };
    }
    // Re-pair allowed: phones reconnect; multi-device shares the host fingerprint.
    const session: PairingSession = {
      sessionId: expected,
      fingerprint: expected,
      pairedAt: new Date().toISOString(),
    };
    this.#paired = session;
    this.log.info("paired", { sessionId: session.sessionId, fingerprint: expected });
    return { ok: true, sessionId: session.sessionId, fingerprint: expected };
  }

  session(): PairingSession | null {
    return this.#paired;
  }

  clear(): void {
    this.#paired = null;
  }
}
