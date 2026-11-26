import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  cwd = process.cwd(),
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
    const listed = await execFileAsync("git", ["ls-files", "-z"], { ...gitOpts, cwd: root });
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
export async function listChanges(cwd = process.cwd()): Promise<ChangedFile[]> {
  const root = await gitRoot(cwd);
  if (!root) return [];
  const opts = { cwd: root, windowsHide: true, shell: process.platform === "win32", maxBuffer: 8_000_000 };
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--numstat", "HEAD"], opts);
    return stdout
      .split("\n")
      .map((line) => line.split("\t"))
      .filter((p) => p.length >= 3 && p[2])
      .map(([add, del, name]) => ({ name: name!.replace(/\\/g, "/"), add: `+${add}`, del: `-${del}` }));
  } catch {
    return [];
  }
}

/** Unified diff for one workspace path. */
export async function readDiff(name: string, cwd = process.cwd()): Promise<string | null> {
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
