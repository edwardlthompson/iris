import { describe, expect, it } from "vitest";
import { classifyStage1 } from "./stage1.js";
import { STAGE1_FIXTURES } from "./fixtures.js";

describe("@iris/router stage1 fixtures", () => {
  for (const fx of STAGE1_FIXTURES) {
    it(fx.id, () => {
      const result = classifyStage1(fx.input);
      if (fx.expect.kind === "unsure") {
        expect(result.kind).toBe("unsure");
      } else {
        expect(result.kind).toBe("preset");
        if (result.kind === "preset") expect(result.preset).toBe(fx.expect.preset);
      }
    });
  }
});

describe("@iris/router stage1 overrides", () => {
  it("raises math to at least performance", () => {
    const r = classifyStage1({
      prompt: "derive the amortized O(n) proof",
      repo: { files: ["math.md"], diffLines: 5 },
    });
    expect(r.kind).toBe("preset");
    if (r.kind === "preset") expect(r.preset).toBe("performance");
  });
});
