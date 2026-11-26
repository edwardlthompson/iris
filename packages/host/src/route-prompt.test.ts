import { describe, expect, it } from "vitest";
import { routePrompt } from "./route-prompt.js";

describe("routePrompt", () => {
  it("pins Manual model without Stage1", () => {
    const r = routePrompt({
      text: "refactor the entire auth subsystem across packages",
      preset: "manual",
      model: "grok-4.7:low",
    });
    expect(r.mode).toBe("manual");
    expect(r.stage1).toBeNull();
    expect(r.pick.effort).toBe("low");
  });

  it("uses Stage1 then caps to Savings ceiling", () => {
    const r = routePrompt({
      text: "refactor the entire authentication architecture and migrate all packages",
      preset: "savings",
    });
    expect(r.mode).toBe("auto");
    expect(r.preset).toBe("savings");
    expect(r.pick.effort).toBe("low");
  });

  it("drops to the next leg when Cursor quota is gone", () => {
    const r = routePrompt({
      text: "fix the typo in the readme title",
      preset: "max",
      quota: { cursorLeft: 0, groups: { "ag-argon": 40 }, claudeOn: true, antiOn: true },
    });
    expect(r.pick.leg).toBe("antigravity");
    expect(r.pick.id).toBe("ag:flash");
  });

  it("lets Auto follow Stage1 up to the max ceiling", () => {
    const easy = routePrompt({ text: "fix the typo in the readme title", preset: "auto" });
    const hard = routePrompt({
      text: "architect a full rewrite of the multi-agent routing system with complex migrations",
      preset: "auto",
    });
    expect(easy.mode).toBe("auto");
    expect(easy.stage1).not.toBeNull();
    expect(["savings", "balanced", "performance", "max"]).toContain(hard.preset);
  });

  it("maps Max ceiling with hard prompt toward xhigh when Stage1 escalates", () => {
    const r = routePrompt({
      text: "architect a full rewrite of the multi-agent routing system with complex migrations",
      preset: "max",
    });
    expect(r.mode).toBe("auto");
    expect(["performance", "max", "balanced", "savings"]).toContain(r.preset);
    expect(r.pick.id.startsWith("grok-4.7:")).toBe(true);
  });
});
