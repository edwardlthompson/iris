import { createHash, generateKeyPairSync } from "node:crypto";
import type { KeyStore } from "./keystore.js";

const PRIV = "host.x25519.private";
const PUB = "host.x25519.public";

export interface HostKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function generateX25519(): HostKeypair {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    publicKey: new Uint8Array(publicKey.export({ type: "spki", format: "der" })),
    privateKey: new Uint8Array(privateKey.export({ type: "pkcs8", format: "der" })),
  };
}

/** Six-digit decimal fingerprint from public key (out-of-band pairing). */
export function fingerprint(publicKey: Uint8Array): string {
  const digest = createHash("sha256").update(publicKey).digest();
  const n = digest.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export async function loadOrCreateKeypair(store: KeyStore): Promise<HostKeypair> {
  const existingPub = await store.get(PUB);
  const existingPriv = await store.get(PRIV);
  if (existingPub && existingPriv) {
    return { publicKey: existingPub, privateKey: existingPriv };
  }
  const kp = generateX25519();
  await store.set(PUB, kp.publicKey);
  await store.set(PRIV, kp.privateKey);
  return kp;
}
