import { describe, expect, it } from "vitest";
import { IRIS_NAME, IRIS_STACK } from "./index.js";

describe("@iris/workspace", () => {
  it("identifies the product", () => {
    expect(IRIS_NAME).toBe("iris");
  });

  it("locks the decided stack", () => {
    expect(IRIS_STACK).toEqual({
      language: "typescript",
      node: 22,
      packageManager: "pnpm",
    });
  });
});
