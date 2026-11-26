import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The Windows tray polls this file and shows a balloon with the Iris mark. */
export function publishTurnNotice(title: string, body: string): void {
  const dir = join(homedir(), ".iris");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "notify.json"), JSON.stringify({ title, body, at: Date.now() }));
  } catch {
    /* the phone notification still fires */
  }
}
