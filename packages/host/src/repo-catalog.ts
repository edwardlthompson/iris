import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { lockedRepo, type RepoLock } from "./workspace-lock.js";

export type RepoRow = {
  name: string;
  path: string | null;
  branch: string | null;
  cloned: boolean;
};

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

function localRoots(lock: RepoLock): RepoRow[] {
  const parents = [
    join(lock.path, ".."),
    homedir(),
    join(homedir(), "source"),
    join(homedir(), "repos"),
    join(homedir(), "projects"),
    join(homedir(), "dev"),
    join(homedir(), "code"),
  ];
  const seen = new Set<string>();
  const rows: RepoRow[] = [];
  const add = (dir: string) => {
    const root = git(dir, ["rev-parse", "--show-toplevel"]);
    if (!root) return;
    const key = root.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      name: basename(root),
      path: root,
      branch: git(root, ["branch", "--show-current"]),
      cloned: true,
    });
  };
  add(lock.path);
  for (const parent of parents) {
    if (!existsSync(parent)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(parent);
    } catch {
      continue;
    }
    for (const name of names) {
      if (rows.length >= 40) return rows;
      const dir = join(parent, name);
      try {
        if (!statSync(dir).isDirectory() || !existsSync(join(dir, ".git"))) continue;
      } catch {
        continue;
      }
      add(dir);
    }
  }
  return rows;
}

function ghNames(): string[] {
  try {
    const out = execFileSync("gh", ["repo", "list", "--limit", "30", "--json", "name"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 8000,
    });
    const rows = JSON.parse(out) as { name?: string }[];
    return rows.map((r) => r.name || "").filter(Boolean);
  } catch {
    return [];
  }
}

/** Local checkouts first. GitHub names come from the PC's existing gh login, with no token stored. */
export function listRepoCatalog(lock = lockedRepo()): RepoRow[] {
  const local = localRoots(lock);
  const have = new Set(local.map((r) => r.name.toLowerCase()));
  const remote = ghNames()
    .filter((name) => !have.has(name.toLowerCase()))
    .map((name) => ({ name, path: null, branch: null, cloned: false }));
  return [...local, ...remote];
}
