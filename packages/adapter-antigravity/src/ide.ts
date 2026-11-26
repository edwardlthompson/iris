/** Probe whether the Antigravity desktop IDE is running. */
export type IdeProbe = {
  isRunning(): boolean | Promise<boolean>;
};

/** Fixed reason when the IDE process is not detected. */
export const REASON_IDE_CLOSED = "ide_closed" as const;

export type IdeClosedReason = typeof REASON_IDE_CLOSED;

/**
 * Default probe: look for common Antigravity process name substrings.
 * Inject a fake probe in tests; override in production if needed.
 */
export function processNameProbe(
  listProcesses: () => string[] | Promise<string[]>,
  needles: string[] = ["antigravity", "Antigravity"],
): IdeProbe {
  return {
    async isRunning() {
      const names = await listProcesses();
      const lower = needles.map((n) => n.toLowerCase());
      return names.some((name) => lower.some((n) => name.toLowerCase().includes(n)));
    },
  };
}
