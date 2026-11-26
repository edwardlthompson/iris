import { type ChildProcess, spawn } from "node:child_process";
import type { HostConfig } from "./config.js";
import type { Logger } from "./logger.js";

export interface ManagedChild {
  id: string;
  proc: ChildProcess;
  startedAt: number;
  lastActiveAt: number;
}

export class Supervisor {
  readonly #children = new Map<string, ManagedChild>();
  #idleTimer: ReturnType<typeof setInterval> | null = null;
  #shuttingDown = false;

  constructor(
    private readonly config: HostConfig,
    private readonly log: Logger,
  ) {}

  start(): void {
    this.#idleTimer = setInterval(() => this.reapIdle(), 1_000);
    this.#idleTimer.unref?.();
  }

  get size(): number {
    return this.#children.size;
  }

  spawn(command: string, args: string[] = [], id = `child_${Date.now()}`): ManagedChild {
    if (this.#shuttingDown) {
      throw new Error("supervisor shutting down");
    }
    if (this.#children.size >= this.config.maxConcurrent) {
      throw new Error(`maxConcurrent ${this.config.maxConcurrent} reached`);
    }
    const proc = spawn(command, args, { stdio: "ignore" });
    const now = Date.now();
    const child: ManagedChild = { id, proc, startedAt: now, lastActiveAt: now };
    this.#children.set(id, child);
    proc.on("exit", () => {
      this.#children.delete(id);
      this.log.info("child exited", { id, pid: proc.pid });
    });
    this.log.info("child spawned", { id, pid: proc.pid, command });
    return child;
  }

  touch(id: string): void {
    const c = this.#children.get(id);
    if (c) c.lastActiveAt = Date.now();
  }

  reapIdle(): number {
    const now = Date.now();
    let n = 0;
    for (const [id, child] of this.#children) {
      if (now - child.lastActiveAt >= this.config.idleTtlMs) {
        this.log.info("reaping idle child", { id });
        child.proc.kill("SIGTERM");
        this.#children.delete(id);
        n += 1;
      }
    }
    return n;
  }

  async shutdown(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    this.#shuttingDown = true;
    if (this.#idleTimer) {
      clearInterval(this.#idleTimer);
      this.#idleTimer = null;
    }
    const pending = [...this.#children.values()];
    for (const child of pending) {
      child.proc.kill(signal);
    }
    await Promise.all(
      pending.map(
        (c) =>
          new Promise<void>((resolve) => {
            if (c.proc.exitCode !== null || c.proc.signalCode) {
              resolve();
              return;
            }
            c.proc.once("exit", () => resolve());
            setTimeout(resolve, 2_000).unref?.();
          }),
      ),
    );
    this.#children.clear();
    this.log.info("supervisor shutdown complete", { signal });
  }
}
