import { loadConfig, type HostConfig } from "./config.js";
import { MemoryKeyStore, type KeyStore } from "./keystore.js";
import { loadOrCreateKeypair } from "./keys.js";
import { createLogger, type Logger } from "./logger.js";
import { PairingService } from "./pairing.js";
import { Supervisor } from "./supervisor.js";

export interface DaemonOptions {
  config?: Partial<HostConfig>;
  keyStore?: KeyStore;
  logger?: Logger;
}

export class HostDaemon {
  readonly config: HostConfig;
  readonly log: Logger;
  readonly supervisor: Supervisor;
  pairing!: PairingService;
  #started = false;

  constructor(private readonly opts: DaemonOptions = {}) {
    this.config = loadConfig(opts.config ?? {});
    this.log = opts.logger ?? createLogger();
    this.supervisor = new Supervisor(this.config, this.log);
  }

  async start(): Promise<this> {
    if (this.#started) return this;
    const store = this.opts.keyStore ?? new MemoryKeyStore();
    const keypair = await loadOrCreateKeypair(store);
    this.pairing = new PairingService(keypair, this.log);
    this.supervisor.start();
    this.#started = true;
    this.log.info("daemon started", {
      fingerprint: this.pairing.hostFingerprint(),
      maxConcurrent: this.config.maxConcurrent,
      idleTtlMs: this.config.idleTtlMs,
    });
    return this;
  }

  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    if (!this.#started) return;
    await this.supervisor.shutdown(signal);
    this.#started = false;
    this.log.info("daemon stopped", { signal });
  }
}
