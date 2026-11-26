import { describe, expect, it } from "vitest";
import {
  GROK_EFFORT_LADDER,
  capPreset,
  grokCreditInventory,
  parseModelId,
  pickForPreset,
  resolveCursorModel,
} from "./models.js";

describe("GROK_EFFORT_LADDER", () => {
  it("ranks xhigh > high > medium > low by score", () => {
    const scores = GROK_EFFORT_LADDER.map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(GROK_EFFORT_LADDER[0]!.effort).toBe("xhigh");
    expect(GROK_EFFORT_LADDER.at(-1)!.effort).toBe("low");
  });

  it("maps presets to Grok efforts", () => {
    expect(pickForPreset("savings").effort).toBe("low");
    expect(pickForPreset("balanced").effort).toBe("medium");
    expect(pickForPreset("performance").effort).toBe("high");
    expect(pickForPreset("max").effort).toBe("xhigh");
  });

  it("resolves manual pin and auto preset", () => {
    const manual = resolveCursorModel({ mode: "manual", modelId: "grok-4.7:high" });
    expect(manual.id).toBe("grok-4.7:high");
    expect(manual.effort).toBe("high");
    const auto = resolveCursorModel({ mode: "auto", preset: "savings" });
    expect(auto.effort).toBe("low");
  });

  it("caps Stage1 suggestion to user ceiling", () => {
    expect(capPreset("max", "savings")).toBe("savings");
    expect(capPreset("savings", "max")).toBe("savings");
    expect(capPreset("performance", "balanced")).toBe("balanced");
    expect(capPreset("balanced", "performance")).toBe("balanced");
  });

  it("parses wire ids and builds credit inventory", () => {
    expect(parseModelId("grok-4.7:xhigh")?.rank).toBe(4);
    expect(parseModelId("composer")).toBeNull();
    const inv = grokCreditInventory(1);
    expect(inv).toHaveLength(4);
    expect(inv.every((m) => m.remainingPct === 1)).toBe(true);
  });
});
