#!/usr/bin/env node
import { HostDaemon } from "./daemon.js";
import { createLogger } from "./logger.js";

async function main(): Promise<void> {
  const log = createLogger();
  const daemon = new HostDaemon({ logger: log });
  await daemon.start();
  log.info("iris-host idle", { fingerprint: daemon.pairing.hostFingerprint() });

  const onSignal = (sig: NodeJS.Signals) => {
    void daemon.stop(sig).then(() => process.exit(0));
  };
  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: String(err) }));
  process.exit(1);
});
