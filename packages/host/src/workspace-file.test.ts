import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { setLockedRepo } from "./workspace-lock.js";
import {
  listChanges,
  listRepoFiles,
  rankFiles,
  readNamedFile,
  searchRepoFiles,
} from "./workspace-file.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("readNamedFile", () => {
  it("reads a repo markdown file by tab name", async () => {
    const file = await readNamedFile("README.md", resolve(root, "packages/host"));
    expect(file?.path.replace(/\\/g, "/")).toBe("README.md");
    expect(file?.text).toMatch(/Iris|iris/);
  });

  it("reads an untracked markdown file by name", async () => {
    const file = await readNamedFile("MODEL_LADDER.md", resolve(root, "packages/host"));
    expect(file?.path.replace(/\\/g, "/")).toBe("docs/MODEL_LADDER.md");
    expect(file?.text).toMatch(/Model ladder/);
  });
  it("searches the locked checkout by name", async () => {
    const hits = await searchRepoFiles("MODEL_LADDER", resolve(root, "packages/host"));
    expect(hits.some((f) => f.endsWith("MODEL_LADDER.md"))).toBe(true);
    expect(await searchRepoFiles("", resolve(root, "packages/host"))).toEqual([]);
    const all = await listRepoFiles(resolve(root, "packages/host"));
    expect(all.length).toBeGreaterThan(10);
    expect(rankFiles(["a/readme.md", "src/model-ladder.ts", "x/mdl.txt"], "mdl")[0]).toBe(
      "x/mdl.txt",
    );
    expect(rankFiles(["a/readme.md", "src/model-ladder.ts"], "mlt")).toEqual([
      "src/model-ladder.ts",
    ]);
  });
  it("uses the locked repo when the process cwd is elsewhere", async () => {
    const home = mkdtempSync(join(tmpdir(), "iris-home-"));
    const repo = mkdtempSync(join(tmpdir(), "iris-lock-"));
    execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
    writeFileSync(join(repo, "note.md"), "locked-note");
    const prev = process.env.IRIS_HOME;
    process.env.IRIS_HOME = home;
    try {
      setLockedRepo(repo);
      const file = await readNamedFile("note.md");
      const hits = await searchRepoFiles("note");
      expect(file?.text).toContain("locked-note");
      expect(hits).toContain("note.md");
    } finally {
      if (prev === undefined) delete process.env.IRIS_HOME;
      else process.env.IRIS_HOME = prev;
    }
  });
  it("lists working tree changes as an array", async () => {
    const files = await listChanges(resolve(root, "packages/host"));
    expect(Array.isArray(files)).toBe(true);
    for (const f of files) expect(f.name).not.toContain("..");
  });
});
