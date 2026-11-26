import { open, seal } from "./crypto.js";

export interface RelayFrame {
  v: 1;
  kind: "ping" | "pong" | "data" | "hello";
  seq: number;
  body?: string;
}

export function encodeFrame(key: Uint8Array, frame: RelayFrame): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(frame));
  return seal(key, json);
}

export function decodeFrame(key: Uint8Array, sealed: Uint8Array): RelayFrame {
  const json = new TextDecoder().decode(open(key, sealed));
  const parsed = JSON.parse(json) as RelayFrame;
  if (parsed.v !== 1 || !parsed.kind) {
    throw new Error("invalid frame");
  }
  return parsed;
}
