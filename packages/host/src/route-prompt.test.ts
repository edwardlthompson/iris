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
    expect(r.pick.score ?? 0).toBeGreaterThan(48);
  });

  it("uses Antigravity Claude before Grok when that group has quota", () => {
    const r = routePrompt({
      text: "fix the typo in the readme title",
      preset: "max",
      quota: {
        cursorLeft: 40,
        groups: { "ag-claudegpt": 80, "ag-gemini": 70 },
        claudeOn: false,
        antiOn: true,
      },
    });
    expect(r.pick.id).toBe("ag:claude-opus-5.5:high");
  });

  it("uses Grok when Claude is not signed in", () => {
    const r = routePrompt({
      text: "fix the typo in the readme title",
      preset: "max",
      quota: { cursorLeft: 40, groups: {}, claudeOn: false, antiOn: false },
    });
    expect(r.pick.leg).toBe("cursor");
    expect(r.pick.id).toBe("grok-4.7:xhigh");
  });

  it("drops to the next leg when Cursor quota is gone", () => {
    const r = routePrompt({
      text: "fix the typo in the readme title",
      preset: "max",
      quota: { cursorLeft: 0, groups: { "ag-argon": 40 }, claudeOn: true, antiOn: true },
    });
    expect(r.pick.leg).toBe("claude");
    expect(r.pick.id).toBe("claude:fable-5.2");
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
    expect(["performance", "max", "balanced"]).toContain(r.preset);
    expect(r.pick.id).toMatch(/sonnet|opus|fable/i);
  });

  it("supports Antigravity Claude Opus 5.5 and Sonnet 5.5 manual selection", () => {
    const r = routePrompt({
      text: "implement feature",
      preset: "manual",
      model: "ag:claude-opus-5.5",
      quota: { cursorLeft: 40, groups: { "ag-claudegpt": 100 }, claudeOn: false, antiOn: true },
    });
    expect(r.pick.leg).toBe("antigravity");
    expect(r.pick.pickerLabel).toBe("Claude Opus 5.5");
  });

  it("picks the frontier model with tokens left, then the next model down", () => {
    const emptyFrontier = routePrompt({
      text: "architect a full rewrite of the multi-agent routing system with complex migrations",
      preset: "max",
      quota: {
        cursorLeft: 0,
        groups: {},
        claudeOn: false,
        antiOn: false,
        poolOn: true,
        poolLeft: 40,
        poolModel: "venice/claude-haiku-5-5",
        poolModels: ["venice/claude-haiku-5-5"],
      },
    });
    expect(emptyFrontier.pick.id).toBe("pool:venice/claude-haiku-5-5");
  });

  it("keeps the Sonnet that still has tokens, whichever program serves it", () => {
    const r = routePrompt({
      text: "Add the repo name to each row in the history sheet",
      preset: "balanced",
      quota: {
        cursorLeft: 0,
        groups: { "ag-claudegpt": 0 },
        claudeOn: false,
        antiOn: true,
        poolOn: true,
        poolLeft: 70,
        poolModel: "venice/claude-sonnet-5-5",
        poolModels: ["venice/claude-sonnet-5-5"],
      },
    });
    expect(r.pick.id).toBe("pool:venice/claude-sonnet-5-5");
  });

  it("keeps a typo on a savings model in Auto", () => {
    const r = routePrompt({
      text: "fix the typo in the readme title",
      preset: "auto",
      quota: {
        cursorLeft: 100,
        groups: { "ag-claudegpt": 100 },
        claudeOn: true,
        antiOn: true,
        poolOn: true,
        poolLeft: 100,
        poolModels: [
          "venice/claude-haiku-5-5",
          "venice/claude-sonnet-5-5",
          "venice/claude-fable-5-2",
        ],
      },
    });
    expect(r.preset).toBe("savings");
    expect(r.pick.level).toBe("savings");
  });

  it("sends a balanced Auto prompt to Sonnet while a Sonnet still has tokens", () => {
    const r = routePrompt({
      text: "Add the repo name to each row in the history sheet",
      preset: "auto",
      quota: {
        cursorLeft: 40,
        groups: { "ag-claudegpt": 80 },
        claudeOn: true,
        antiOn: true,
        poolOn: true,
        poolLeft: 100,
        poolModel: "venice/claude-sonnet-5-5",
        poolModels: [
          "venice/claude-haiku-5-5",
          "venice/claude-sonnet-5-5",
          "venice/claude-opus-5-5",
        ],
      },
    });
    expect(r.pick.id).toMatch(/sonnet/i);
  });

  it("supports Venice frontier models in manual pool routing", () => {
    const r = routePrompt({
      text: "audit code",
      preset: "manual",
      model: "pool:venice/claude-opus-5-5",
      quota: {
        cursorLeft: 40,
        groups: {},
        claudeOn: false,
        antiOn: false,
        poolOn: true,
        poolLeft: 100,
        poolModel: "venice/gemini-3-8-flash",
        poolModels: ["venice/gemini-3-8-flash", "venice/claude-opus-5-5"],
      },
    });
    expect(r.pick.leg).toBe("pool");
    expect(r.pick.id).toBe("pool:venice/claude-opus-5-5");
  });
});
