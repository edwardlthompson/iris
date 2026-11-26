import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type DeviceRecord = { token: string; pairedAt: string };

function devicesFile(file = join(homedir(), ".iris", "devices.json")): string {
  return file;
}

async function readDevices(file: string): Promise<DeviceRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as DeviceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Remember a phone so it can reconnect without the 6-digit code. */
export async function issueDeviceToken(file?: string): Promise<string> {
  const path = file ?? devicesFile();
  const token = randomBytes(16).toString("hex");
  const list = await readDevices(path);
  list.push({ token, pairedAt: new Date().toISOString() });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(list), "utf8");
  return token;
}

export async function deviceTokenOk(token: string, file?: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(token)) return false;
  const list = await readDevices(file ?? devicesFile());
  return list.some((d) => d.token === token);
}
