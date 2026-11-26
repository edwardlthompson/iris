import { randomBytes } from "node:crypto";
import { xsalsa20poly1305 } from "@noble/ciphers/salsa.js";

const NONCE_LEN = 24;

/** Derive a 32-byte session key from shared secret material. */
export function sessionKeyFromShared(shared: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  out.set(shared.subarray(0, Math.min(32, shared.length)));
  return out;
}

export function seal(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_LEN);
  const aead = xsalsa20poly1305(key, nonce);
  const ciphertext = aead.encrypt(plaintext);
  const out = new Uint8Array(NONCE_LEN + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, NONCE_LEN);
  return out;
}

export function open(key: Uint8Array, sealed: Uint8Array): Uint8Array {
  if (sealed.length < NONCE_LEN + 16) {
    throw new Error("sealed payload too short");
  }
  const nonce = sealed.subarray(0, NONCE_LEN);
  const ciphertext = sealed.subarray(NONCE_LEN);
  const aead = xsalsa20poly1305(key, nonce);
  return aead.decrypt(ciphertext);
}
