import { describe, expect, it } from "vitest";
import { pickBestAvailable } from "./available.js";

describe("pickBestAvailable", () => {
  it("skips exhausted quota and returns the best remaining leg", () => {
    expect(
      pickBestAvailable([
        { id: "claude", hasCredentials: true, quotaOk: false, rank: 100 },
        { id: "cursor", hasCredentials: true, quotaOk: true, rank: 40 },
        { id: "codex", hasCredentials: false, quotaOk: true, rank: 80 },
      ]),
    ).toBe("cursor");
  });

  it("returns null when nothing is spendable", () => {
    expect(
      pickBestAvailable([{ id: "claude", hasCredentials: true, quotaOk: false, rank: 100 }]),
    ).toBeNull();
  });
});
