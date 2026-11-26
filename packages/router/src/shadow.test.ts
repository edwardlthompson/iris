import { describe, expect, it } from "vitest";
import {
  SHADOW_GATE,
  canOfferAuto,
  initialModeState,
  recordShadowPrompt,
  setMode,
} from "./modes.js";
import { ShadowLog, pairShadow } from "./shadow.js";
import { buildBadge, modeAllowsAutoRoute } from "./badge.js";

describe("@iris/router shadow → auto", () => {
  it("produces paired shadow rows", () => {
    const log = new ShadowLog();
    log.append(
      pairShadow({
        promptId: "p1",
        suggestedLeg: "claude",
        suggestedPreset: "balanced",
        actualLeg: "claude",
        actualPreset: "performance",
        escalationNote: "two failures",
      }),
    );
    expect(log.count()).toBe(1);
    expect(log.all()[0]?.matched).toBe(false);
    expect(log.all()[0]?.note).toBe("two failures");
  });

  it("offers auto only past the 20-prompt shadow gate", () => {
    let state = initialModeState("shadow");
    expect(canOfferAuto(state)).toBe(false);
    expect(setMode(state, "auto")).toEqual({ error: "shadow_gate" });

    for (let i = 0; i < SHADOW_GATE; i++) {
      state = recordShadowPrompt(state);
    }
    expect(canOfferAuto(state)).toBe(true);
    const next = setMode(state, "auto");
    expect("mode" in next && next.mode).toBe("auto");
    expect(modeAllowsAutoRoute("auto")).toBe(true);
    expect(modeAllowsAutoRoute("suggest")).toBe(false);
  });

  it("badge shows override and escalation notes", () => {
    let state = initialModeState("shadow");
    for (let i = 0; i < SHADOW_GATE; i++) state = recordShadowPrompt(state);
    const badge = buildBadge({
      state,
      overrideNote: "user pinned max",
      escalationNote: "diff > 400 lines",
    });
    expect(badge.offerAuto).toBe(true);
    expect(badge.overrideNote).toBe("user pinned max");
    expect(badge.escalationNote).toBe("diff > 400 lines");
    expect(badge.label).toBe("shadow");
  });
});
