import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type ActionsMinutes = {
  included: number;
  used: number;
  leftPct: number;
};

export function actionsLeft(doc: {
  included_minutes?: number;
  total_minutes_used?: number;
}): ActionsMinutes | null {
  const included = Number(doc.included_minutes ?? 0);
  const used = Number(doc.total_minutes_used ?? 0);
  if (!Number.isFinite(included) || included <= 0) return null;
  const leftPct = Math.max(0, Math.min(100, Math.round((1 - used / included) * 100)));
  return { included, used, leftPct };
}

/** Included Actions minutes for the gh login. Null when the token lacks the user scope. */
export async function readActionsMinutes(): Promise<ActionsMinutes | null> {
  try {
    const user = (
      await exec("gh", ["api", "user", "--jq", ".login"], { timeout: 8000, windowsHide: true })
    ).stdout.trim();
    if (!/^[A-Za-z0-9-]+$/.test(user)) return null;
    const raw = (
      await exec("gh", ["api", `users/${user}/settings/billing/actions`], {
        timeout: 8000,
        windowsHide: true,
      })
    ).stdout;
    return actionsLeft(
      JSON.parse(raw) as { included_minutes?: number; total_minutes_used?: number },
    );
  } catch {
    return null;
  }
}
