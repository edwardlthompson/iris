import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type UiPrefs = {
  preset?: string;
  model?: string;
  leg?: string;
};

const MODES = new Set(["auto", "manual", "savings", "balanced", "performance", "max"]);

function prefsFile(file = join(homedir(), ".iris", "ui-prefs.json")): string {
  return file;
}

export async function readPrefs(file?: string): Promise<UiPrefs> {
  try {
    const parsed = JSON.parse(await readFile(file ?? prefsFile(), "utf8")) as UiPrefs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Merge a device change into the one host copy every phone reads. */
export async function savePrefs(patch: UiPrefs, file?: string): Promise<UiPrefs> {
  const path = file ?? prefsFile();
  const current = await readPrefs(path);
  const next: UiPrefs = { ...current };
  if (patch.preset && MODES.has(patch.preset)) next.preset = patch.preset;
  if (patch.model && typeof patch.model === "string") next.model = patch.model;
  if (patch.leg && typeof patch.leg === "string") next.leg = patch.leg;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next), "utf8");
  return next;
}
