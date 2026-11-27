import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deviceTokenOk, issueDeviceToken } from "./devices.js";
import { listTransportRungs } from "./runtime.js";

describe("device token", () => {
  it("reconnects with the issued token and rejects junk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "iris-dev-"));
    const file = join(dir, "devices.json");
    try {
      const token = await issueDeviceToken(file);
      expect(await deviceTokenOk(token, file)).toBe(true);
      expect(await deviceTokenOk("nope", file)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("transport ladder", () => {
  it("lists LAN first and appends a tunnel when configured", () => {
    const rungs = listTransportRungs(7842, { IRIS_TUNNEL_WS: "wss://example.test/iris" });
    expect(rungs[0]).toEqual({ rung: "lan", ws: "ws://127.0.0.1:7842" });
    expect(rungs.at(-1)).toEqual({ rung: "tunnel", ws: "wss://example.test/iris" });
  });
});
