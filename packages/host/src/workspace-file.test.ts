import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listChanges, readNamedFile } from "./workspace-file.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("readNamedFile", () => {
  it("reads a repo markdown file by tab name", async () => {
    const file = await readNamedFile("README.md", resolve(root, "packages/host"));
    expect(file?.path.replace(/\\/g, "/")).toBe("README.md");
    expect(file?.text).toMatch(/Iris|iris/);
  });

  it("lists working tree changes as an array", async () => {
    const files = await listChanges(resolve(root, "packages/host"));
    expect(Array.isArray(files)).toBe(true);
    for (const f of files) expect(f.name).not.toContain("..");
  });
});
