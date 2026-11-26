import { createHash } from "node:crypto";
import { networkInterfaces } from "node:os";
import { LanDiscovery, RelayServer } from "@iris/relay-core";
import { createControlHandler } from "./control.js";
import type { HostDaemon } from "./daemon.js";

/** Derive a 32-byte relay session key from the host keypair material. */
export function relayKeyFromPublic(publicKey: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(publicKey).digest());
}

export function lanIpv4(): string {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const e of entries ?? []) {
      if (e.family === "IPv4" && !e.internal) return e.address;
    }
  }
  return "127.0.0.1";
}

export type HostRuntime = {
  relay: RelayServer;
  fingerprint: string;
  advertiseHost: string;
  port: number;
  wsUrl: string;
};

/** Attach LAN WebSocket relay so phones can pair and talk to the host. */
export async function startHostRuntime(
  daemon: HostDaemon,
  opts?: { port?: number; bind?: string },
): Promise<HostRuntime> {
  await daemon.start();
  const fingerprint = daemon.pairing.hostFingerprint();
  const bind = opts?.bind ?? "0.0.0.0";
  const advertiseHost = lanIpv4();
  const key = relayKeyFromPublic(
    // PairingService doesn't export raw pubkey; re-fingerprint via store path —
    // use fingerprint string as key material for the demo relay.
    new TextEncoder().encode(`iris-relay:${fingerprint}`),
  );
  const onText = createControlHandler({
    pairing: daemon.pairing,
    fingerprint,
  });
  const relay = new RelayServer({
    key,
    discovery: new LanDiscovery(),
    fingerprint,
    port: opts?.port ?? 7842,
    host: bind,
    onText,
  });
  await relay.start();
  const port = relay.port;
  return {
    relay,
    fingerprint,
    advertiseHost,
    port,
    wsUrl: `ws://${advertiseHost}:${port}`,
  };
}
