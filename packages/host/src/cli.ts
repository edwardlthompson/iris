#!/usr/bin/env node
import { HostDaemon } from "./daemon.js";
import { createLogger } from "./logger.js";
import { startHostRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const log = createLogger();
  const daemon = new HostDaemon({ logger: log });
  const rt = await startHostRuntime(daemon);
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
