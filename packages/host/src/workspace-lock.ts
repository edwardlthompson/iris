import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

export type RepoLock = { path: string; name: string; branch: string | null };

function file(): string {
  return join(process.env.IRIS_HOME || join(homedir(), ".iris"), "workspace.json");
}

function git(cwd: string, args: string[]): string | null {
  try {
    const out = execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 3000,
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** Point Iris at a local checkout. Rejects a path that is not a git root. */
export function setLockedRepo(path: string): RepoLock {
  const root = git(path, ["rev-parse", "--show-toplevel"]);
  if (!root || !existsSync(root)) throw new Error("Not a local git repository");
  const saved = file();
  mkdirSync(join(saved, ".."), { recursive: true });
  writeFileSync(saved, JSON.stringify({ path: root }, null, 2));
  return {
    path: root,
    name: basename(root),
    branch: git(root, ["branch", "--show-current"]),
  };
}

/** The one repository Iris is allowed to edit. Created once from the host's git root. */
export function lockedRepo(): RepoLock {
  const saved = file();
  if (existsSync(saved)) {
    try {
      const row = JSON.parse(readFileSync(saved, "utf8")) as { path?: string };
      if (row.path && existsSync(row.path)) {
        return {
          path: row.path,
          name: basename(row.path),
          branch: git(row.path, ["branch", "--show-current"]),
        };
      }
    } catch {
      /* rewrite below */
    }
  }
  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]) || process.cwd();
  const lock = {
    path: root,
    name: basename(root),
    branch: git(root, ["branch", "--show-current"]),
  };
  try {
    mkdirSync(join(homedir(), ".iris"), { recursive: true });
    writeFileSync(saved, JSON.stringify({ path: lock.path }, null, 2));
  } catch {
    /* still return the lock for this process */
  }
  return lock;
}

export function repoLockLine(lock = lockedRepo()): string {
  const branch = lock.branch ? ` on branch ${lock.branch}` : "";
  return `Iris repository lock: edit only ${lock.path} (${lock.name}${branch}). Do not open or change any other repository.`;
}

/** Antigravity and Cursor window titles include the open folder name. */
export function titleMatchesRepo(title: string, repoName: string): boolean {
  return title.toLowerCase().includes(repoName.toLowerCase());
}
