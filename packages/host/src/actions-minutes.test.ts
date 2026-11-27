import { describe, expect, it } from "vitest";
import { actionsLeft } from "./actions-minutes.js";

describe("actionsLeft", () => {
  it("turns included minutes into percent left", () => {
    expect(actionsLeft({ included_minutes: 2000, total_minutes_used: 500 })).toEqual({
      included: 2000,
      used: 500,
      leftPct: 75,
    });
  });

  it("returns null when the plan has no included minutes", () => {
    expect(actionsLeft({ included_minutes: 0, total_minutes_used: 0 })).toBeNull();
  });
});
