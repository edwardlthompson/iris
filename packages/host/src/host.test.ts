import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requestPhoneApproval, settleApproval } from "./approvals.js";
import { HostDaemon } from "./daemon.js";
import { FileKeyStore, MemoryKeyStore } from "./keystore.js";
import { createLogger, type LogRecord } from "./logger.js";
import { Supervisor } from "./supervisor.js";
import { loadConfig } from "./config.js";

function captureLogger() {
  const records: LogRecord[] = [];
  return {
    records,
    logger: createLogger((rec) => {
      records.push(rec);
    }),
  };
}

describe("@iris/host pairing", () => {
  it("pairs when fingerprints match and refuses mismatches", async () => {
    const { logger } = captureLogger();
    const daemon = await new HostDaemon({
      keyStore: new MemoryKeyStore(),
      logger,
    }).start();
    const fp = daemon.pairing.hostFingerprint();
    expect(fp).toMatch(/^\d{6}$/);

    const bad = daemon.pairing.pair("000000" === fp ? "000001" : "000000");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("fingerprint_mismatch");

    const good = daemon.pairing.pair(fp);
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.fingerprint).toBe(fp);
      expect(good.sessionId).toBeTruthy();
    }
    await daemon.stop();
  });
});

describe("@iris/host supervisor", () => {
  it("reaps idle children and shuts down on SIGTERM", async () => {
    const { logger, records } = captureLogger();
    const config = loadConfig({ maxConcurrent: 2, idleTtlMs: 50 });
    const supervisor = new Supervisor(config, logger);
    supervisor.start();

    const child = supervisor.spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"]);
    expect(supervisor.size).toBe(1);
    expect(child.proc.pid).toBeTruthy();

    await new Promise((r) => setTimeout(r, 80));
    const reaped = supervisor.reapIdle();
    expect(reaped).toBeGreaterThanOrEqual(1);
    expect(supervisor.size).toBe(0);

    const child2 = supervisor.spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"]);
    expect(supervisor.size).toBe(1);
    await supervisor.shutdown("SIGTERM");
    expect(supervisor.size).toBe(0);
    expect(child2.proc.killed || child2.proc.exitCode !== null).toBe(true);
    expect(records.some((r) => r.msg === "supervisor shutdown complete")).toBe(true);
  });

  it("enforces maxConcurrent", async () => {
    const { logger } = captureLogger();
    const supervisor = new Supervisor(loadConfig({ maxConcurrent: 1, idleTtlMs: 60_000 }), logger);
    supervisor.start();
    supervisor.spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"]);
    expect(() => supervisor.spawn(process.execPath, ["-e", "setInterval(()=>{}, 1000)"])).toThrow(
      /maxConcurrent/,
    );
    await supervisor.shutdown();
  });
});

describe("tool approval", () => {
  it("resumes when the phone sends Allow", async () => {
    const done = requestPhoneApproval("t1", () => {});
    expect(settleApproval("t1", "Allow")).toBe(true);
    await expect(done).resolves.toBe("Allow");
  });
});

describe("FileKeyStore", () => {
  it("keeps a key across two store instances", async () => {
    const dir = await mkdtemp(join(tmpdir(), "iris-keys-"));
    try {
      const first = new FileKeyStore(dir);
      await first.set("host", new Uint8Array([1, 2, 3, 4]));
      const second = new FileKeyStore(dir);
      expect(Array.from((await second.get("host")) ?? [])).toEqual([1, 2, 3, 4]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
