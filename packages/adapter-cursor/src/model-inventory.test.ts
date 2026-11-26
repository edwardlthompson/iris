import { describe, expect, it } from "vitest";
import { modelsFromMenuRows } from "./model-picker-cdp.js";

describe("modelsFromMenuRows", () => {
  it("keeps Grok effort wire ids and drops Auto", () => {
    const rows = modelsFromMenuRows([
      { id: "model-item-auto", label: "Auto" },
      { id: "model-item-grok-4.7", label: "Grok 4.7 Low" },
      { id: "model-item-composer", label: "Composer 2.5" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["grok-4.7:low", "composer"]);
    expect(rows[0]?.rank).toBeGreaterThan(rows[1]?.rank ?? 0);
  });
});