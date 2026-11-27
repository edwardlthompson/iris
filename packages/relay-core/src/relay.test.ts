import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { backoffMs } from "./backoff.js";
import { MemoryDiscovery } from "./discovery.js";
import { selectActiveRung } from "./ladder.js";
import { RelayClient, RelayServer } from "./relay.js";
import { decodeFrame, encodeFrame } from "./frame.js";

describe("@iris/relay-core ladder", () => {
  it("selects LAN rank 1 first", () => {
    const active = selectActiveRung({ lan: "ws://127.0.0.1:9" });
    expect(active).toEqual({
      rung: "lan",
      rank: 1,
      endpoint: "ws://127.0.0.1:9",
      pinned: false,
    });
  });

  it("backoff doubles then caps", () => {
    expect(backoffMs(0)).toBe(250);
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(10)).toBe(4_000);
  });
});

describe("@iris/relay-core crypto frame", () => {
  it("round-trips a sealed frame", () => {
    const key = randomBytes(32);
    const sealed = encodeFrame(key, { v: 1, kind: "hello", seq: 1, body: "hi" });
    expect(decodeFrame(key, sealed)).toEqual({ v: 1, kind: "hello", seq: 1, body: "hi" });
  });
});

describe("@iris/relay-core paired WSS", () => {
  it("completes a paired round-trip and survives a dropped socket", async () => {
    const key = randomBytes(32);
    const fingerprint = "123456";
    const discovery = new MemoryDiscovery();
    const server = await new RelayServer({ key, discovery, fingerprint }).start();
    expect(server.activeRung?.rung).toBe("lan");
    expect(server.activeRung?.rank).toBe(1);

    const client = await new RelayClient({ key, discovery, fingerprint }).connect();
    expect(client.activeRung?.rung).toBe("lan");
    const reply = await client.roundTrip("ping-body");
    expect(reply).toBe("ping-body");

    await client.reconnectAfterDrop();
    const again = await client.roundTrip("after-drop");
    expect(again).toBe("after-drop");

    await client.close();
    await server.stop();
  });

  it("delivers a sealed JSON control frame to the host handler", async () => {
    const key = randomBytes(32);
    const seen: string[] = [];
    const discovery = new MemoryDiscovery();
    const server = await new RelayServer({
      key,
      discovery,
      fingerprint: "123456",
      onText: (_ws, text) => {
        seen.push(text);
      },
    }).start();
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve) => ws.once("open", () => resolve()));
    ws.send(
      encodeFrame(key, { v: 1, kind: "data", seq: 1, body: JSON.stringify({ type: "status" }) }),
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(seen[0]).toContain('"type":"status"');
    ws.close();
    await server.stop();
  });
});
