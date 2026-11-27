import { listWorkbenchTargets } from "@iris/adapter-cursor";
import { titleMatchesRepo } from "./workspace-lock.js";

export type IdeTitles = { cursor: string[]; antigravity: string[] };
export type RepoMismatch = { program: string; title: string };

const APP_CHROME = /^(cursor agents|cursor|antigravity)$/i;

/** A title that names some other project. App chrome and a matching folder are not a mismatch. */
export function blockingTitle(titles: string[], repoName: string): string | null {
  if (titles.some((title) => titleMatchesRepo(title, repoName))) return null;
  return titles.find((title) => title.trim() && !APP_CHROME.test(title.trim())) ?? null;
}

export async function ideWindowTitles(): Promise<IdeTitles> {
  let cursor: string[] = [];
  let antigravity: string[] = [];
  try {
    cursor = (await listWorkbenchTargets()).map((target) => target.title).filter(Boolean);
  } catch {
    /* Cursor CDP is down */
  }
  try {
    const res = await fetch("http://127.0.0.1:9000/json/list");
    if (res.ok) {
      const rows = (await res.json()) as { type?: string; title?: string; url?: string }[];
      antigravity = rows
        .filter(
          (t) =>
            t.type === "page" &&
            (/antigravity/i.test(t.title || "") || /:7881|workbench/i.test(t.url || "")),
        )
        .map((t) => t.title || "")
        .filter(Boolean);
    }
  } catch {
    /* Antigravity CDP is down */
  }
  return { cursor, antigravity };
}

export function repoMismatches(repoName: string, titles: IdeTitles): RepoMismatch[] {
  const out: RepoMismatch[] = [];
  const cursor = blockingTitle(titles.cursor, repoName);
  const anti = blockingTitle(titles.antigravity, repoName);
  if (cursor) out.push({ program: "Cursor", title: cursor });
  if (anti) out.push({ program: "Antigravity", title: anti });
  return out;
}
