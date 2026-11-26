import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("serve-phone MIME", () => {
  it("serves CSS as text/css so remote chrome styles apply", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../scripts/serve-phone.mjs"),
      "utf8",
    );
    expect(src).toMatch(/"\.css":\s*"text\/css/);
  });
});
