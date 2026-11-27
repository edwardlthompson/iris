import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { lockedRepo } from "./workspace-lock.js";

const execFileAsync = promisify(execFile);

function lockPath(): string {
  try {
    return lockedRepo().path;
  } catch {
    return process.cwd();
  }
}

async function gitRoot(cwd: string): Promise<string | null> {
  try {
    const top = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    return top.stdout.trim();
  } catch {
    return null;
  }
}

/** Resolve a desktop tab name to a workspace file and return its text. */
export async function readNamedFile(
  name: string,
  cwd = lockPath(),
): Promise<{ path: string; text: string } | null> {
  const base = name.split(/[/\\]/).pop() || name;
  const baseLower = base.toLowerCase();
  const gitOpts = {
    cwd,
    windowsHide: true,
    shell: process.platform === "win32",
    maxBuffer: 8_000_000,
  };
  let files: string[] = [];
  const root = await gitRoot(cwd);
  if (!root) return null;
  try {
    const listed = await execFileAsync("git", ["ls-files", "-z", "-co", "--exclude-standard"], {
      ...gitOpts,
      cwd: root,
    });
    files = listed.stdout.split("\0").filter(Boolean);
  } catch {
    return null;
  }
  const leaf = (f: string) => (f.split(/[/\\]/).pop() || f).toLowerCase();
  const norm = name.replace(/\\/g, "/");
  const same = files.filter((f) => leaf(f) === baseLower);
  const hit =
    same.find((f) => f.replace(/\\/g, "/") === norm) ??
    same.slice().sort((a, b) => a.length - b.length)[0];
  if (!hit) return null;
  const abs = resolve(root, hit);
  try {
    const buf = await readFile(abs);
    const text = buf.toString("utf8").slice(0, 200_000);
    return { path: hit.replace(/\\/g, "/"), text };
  } catch {
    return null;
  }
}

export type ChangedFile = { name: string; add: string; del: string };

/** Working tree files vs HEAD, with numstat when git can print it. */
const INVENTORY_TTL_MS = 30_000;
const INVENTORY_MAX = 8000;
const inventoryCache = new Map<string, { at: number; files: string[] }>();

/** Every tracked or untracked (non-ignored) file in the locked checkout, cached briefly. */
export async function listRepoFiles(cwd = lockPath()): Promise<string[]> {
  const root = await gitRoot(cwd);
  if (!root) return [];
  const hit = inventoryCache.get(root);
  if (hit && Date.now() - hit.at < INVENTORY_TTL_MS) return hit.files;
  try {
    const listed = await execFileAsync("git", ["ls-files", "-z", "-co", "--exclude-standard"], {
      cwd: root,
      windowsHide: true,
      shell: process.platform === "win32",
      maxBuffer: 16_000_000,
    });
    const files = listed.stdout
      .split("\0")
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, "/"))
      .sort()
      .slice(0, INVENTORY_MAX);
    inventoryCache.set(root, { at: Date.now(), files });
    return files;
  } catch {
    return [];
  }
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (const ch of s) if (ch === q[i] && ++i === q.length) return true;
  return q.length === 0;
}

/** Rank: basename prefix, basename substring, path substring, then fuzzy subsequence. */
export function rankFiles(files: string[], query: string, limit = 60): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return files.slice(0, limit);
  const scored: Array<[number, string]> = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    const base = lower.slice(lower.lastIndexOf("/") + 1);
    const score = base.startsWith(q)
      ? 0
      : base.includes(q)
        ? 1
        : lower.includes(q)
          ? 2
          : isSubsequence(q, base)
            ? 3
            : -1;
    if (score >= 0) scored.push([score * 1000 + f.length, f]);
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, f]) => f);
}

export async function searchRepoFiles(query: string, cwd = lockPath()): Promise<string[]> {
  if (!query.trim()) return [];
  return rankFiles(await listRepoFiles(cwd), query, 40);
}

export async function listChanges(cwd = lockPath()): Promise<ChangedFile[]> {
  const root = await gitRoot(cwd);
  if (!root) return [];
  const opts = {
    cwd: root,
    windowsHide: true,
    shell: process.platform === "win32",
    maxBuffer: 8_000_000,
  };
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--numstat", "HEAD"], opts);
    return stdout
      .split("\n")
      .map((line) => line.split("\t"))
      .filter((p) => p.length >= 3 && p[2])
      .map(([add, del, name]) => ({
        name: name!.replace(/\\/g, "/"),
        add: `+${add}`,
        del: `-${del}`,
      }));
  } catch {
    return [];
  }
}

/** Unified diff for one workspace path. */
export async function readDiff(name: string, cwd = lockPath()): Promise<string | null> {
  const root = await gitRoot(cwd);
  if (!root || name.includes("..")) return null;
  try {
    const { stdout } = await execFileAsync("git", ["diff", "HEAD", "--", name], {
      cwd: root,
      windowsHide: true,
      shell: process.platform === "win32",
      maxBuffer: 2_000_000,
    });
    return stdout.slice(0, 200_000);
  } catch {
    return null;
  }
}
