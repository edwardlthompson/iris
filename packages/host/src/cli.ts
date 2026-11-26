#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { HostDaemon } from "./daemon.js";
import { FileKeyStore } from "./keystore.js";
import { createLogger } from "./logger.js";
import { listTransportRungs, startHostRuntime } from "./runtime.js";

/** Publish code for phone auto-pair (`GET /pair-code.json` via serve-phone). */
async function publishPairCode(fingerprint: string, port: number): Promise<void> {
  const rungs = listTransportRungs(port);
  const payload = JSON.stringify({
    code: fingerprint,
    ws: rungs[0]?.ws ?? `ws://127.0.0.1:${port}`,
    rungs,
    ts: Date.now(),
  });
  const dir = join(homedir(), ".iris");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "pair-code.json"), payload, "utf8");
}

async function main(): Promise<void> {
  const log = createLogger();
  const daemon = new HostDaemon({ logger: log, keyStore: new FileKeyStore() });
  const rt = await startHostRuntime(daemon);
  await publishPairCode(rt.fingerprint, rt.port).catch((e) =>
    log.info("pair-code publish skipped", { err: String(e) }),
  );
  log.info("iris-host ready", {
    fingerprint: rt.fingerprint,
    wsUrl: rt.wsUrl,
    advertiseHost: rt.advertiseHost,
    port: rt.port,
  });
  // Human-readable pairing banner for first-run / ADB testing.
  console.log("");
  console.log("=== Iris host ===");
  console.log(`Pairing code:  ${rt.fingerprint}`);
  console.log(`LAN WebSocket: ${rt.wsUrl}`);
  console.log("Phone: open the Iris PWA, enter the pairing code.");
  console.log("Legs adapt to credits — Cursor preferred when it has remaining quota.");
  console.log("Ctrl+C to stop.");
  console.log("");

  const onSignal = (sig: NodeJS.Signals) => {
    void rt.relay
      .stop()
      .then(() => daemon.stop(sig))
      .then(() => process.exit(0));
  };
  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: String(err) }));
  process.exit(1);
});
