import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { historyForRepo } from "./unified-chat.js";
import { repoMismatches } from "./ide-windows.js";
import { setLockedRepo } from "./workspace-lock.js";

describe("repo catalog", () => {
  it("rejects a folder that is not a git root", () => {
    const dir = mkdtempSync(join(tmpdir(), "iris-repo-"));
    process.env.IRIS_HOME = dir;
    expect(() => setLockedRepo(dir)).toThrow(/git repository/);
  });

  it("keeps history rows that name the locked repo", () => {
    const rows = historyForRepo(
      [
        { id: "unified", title: "Unified", project: "Cursor", mtimeMs: 3 },
        { id: "a", title: "Fix ladder", project: "Iris", mtimeMs: 2 },
        { id: "b", title: "TrendAlgo bot", project: "Cursor", mtimeMs: 1 },
        { id: "c", title: "notes", project: "Antigravity", mtimeMs: 0 },
      ],
      "Iris",
    );
    expect(rows.map((r) => r.id)).toEqual(["unified", "a"]);
    expect(rows[0]?.title).toBe("Iris");
  });

  it("names the program and the window that is on the wrong repo", () => {
    const rows = repoMismatches("Iris", {
      cursor: ["TrendAlgo Bot — Cursor", "Cursor Agents"],
      antigravity: ["Antigravity", "Iris — Antigravity"],
    });
    expect(rows).toEqual([{ program: "Cursor", title: "TrendAlgo Bot — Cursor" }]);
  });
});

describe("set lock writes workspace.json", () => {
  it("stores the git toplevel", () => {
    const home = mkdtempSync(join(tmpdir(), "iris-lock-"));
    const repo = mkdtempSync(join(tmpdir(), "iris-git-"));
    execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
    process.env.IRIS_HOME = home;
    const lock = setLockedRepo(repo);
    expect(lock.path.replaceAll("\\", "/").toLowerCase()).toBe(
      repo.replaceAll("\\", "/").toLowerCase(),
    );
    expect(lock.name).toBe(repo.split(/[\\/]/).pop());
  });
});
