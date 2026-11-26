export type IdeProbe = { isRunning(): boolean | Promise<boolean> };

export const REASON_IDE_CLOSED = "ide_closed" as const;
export const REASON_NO_CREDITS = "no_credits" as const;

export function processNameProbe(
  listProcesses: () => string[] | Promise<string[]>,
  needles: string[] = ["Cursor", "cursor"],
): IdeProbe {
  return {
    async isRunning() {
      const names = await listProcesses();
      const lower = needles.map((n) => n.toLowerCase());
      return names.some((name) => lower.some((n) => name.toLowerCase().includes(n)));
    },
  };
}
