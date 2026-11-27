import { describe, expect, it } from "vitest";
import { diffPaths, fileWindow, matchCommand, userContent } from "./pool-tools.js";

describe("pool tools", () => {
  it("allowlists four commands and rejects extras", () => {
    expect(matchCommand("pnpm test")).toEqual(["pnpm", "test"]);
    expect(matchCommand("git status")).toEqual(["git", "status"]);
    expect(matchCommand("pnpm test --watch")).toBeNull();
    expect(matchCommand("rm -rf")).toBeNull();
  });

  it("rejects a diff that leaves the lock", () => {
    expect(diffPaths("--- a/src/a.ts\n+++ b/src/a.ts\n")).toEqual(["src/a.ts", "src/a.ts"]);
    expect(diffPaths("--- a/../secret\n+++ b/../secret\n")).toBeNull();
  });

  it("returns a numbered line window instead of the whole file", () => {
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
    const view = fileWindow(text, "90", "5");
    expect(view).toContain("showing 90-94");
    expect(view).toContain("90|line 90");
    expect(view).not.toContain("1|line 1");
  });
  it("sends photos as image_url parts", () => {
    const content = userContent("look", [{ data: "abc", type: "image/png" }]);
    expect(Array.isArray(content)).toBe(true);
    expect(JSON.stringify(content)).toContain("data:image/png;base64,abc");
  });
});
