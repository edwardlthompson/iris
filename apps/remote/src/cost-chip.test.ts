import { describe, expect, it, vi } from "vitest";
import { CostChipController, budgetTone } from "./cost-chip.js";
import { LocalStoragePinStore, MemoryPinStore } from "./pin-store.js";
import { PRESET_POLICIES } from "./presets.js";
import { toChipView } from "./view.js";

describe("@iris/remote presets", () => {
  it("ships B8 defaults", () => {
    expect(PRESET_POLICIES.savings.default).toBe("claude-haiku-5-5");
    expect(PRESET_POLICIES.max.hard_cap_usd).toBe(50);
  });
});

describe("@iris/remote cost chip", () => {
  it("shows leg, model, effort, estimate, pool and debounces 400ms", async () => {
    vi.useFakeTimers();
    const chip = new CostChipController(new MemoryPinStore());
    const p = chip.update({
      leg: "claude",
      estimateUsd: 0.42,
      topology: "pool",
      poolId: "stub",
      suggestedPreset: "balanced",
    });
    expect(chip.snapshot).toBeNull();
    vi.advanceTimersByTime(399);
    expect(chip.snapshot).toBeNull();
    vi.advanceTimersByTime(1);
    const snap = await p;
    expect(snap.leg).toBe("claude");
    expect(snap.model).toBe("claude-sonnet-5-5");
    expect(snap.effort).toBe("medium");
    expect(snap.estimateUsd).toBe(0.42);
    expect(snap.pool).toBe("stub");
    expect(snap.refLabel).toBe("ref. CursorBench");
    expect(snap.mode).toBe("suggest");
    const view = toChipView(snap);
    expect(view?.line).toContain("claude");
    expect(view?.budgetClass).toBe("budget-ok");
    vi.useRealTimers();
  });

  it("pin survives reload via storage", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    } as Storage;
    const store = new LocalStoragePinStore(storage);
    const a = new CostChipController(store);
    a.pin("performance");
    const b = new CostChipController(new LocalStoragePinStore(storage));
    const snap = b.build({
      leg: "claude",
      estimateUsd: 1,
      topology: "direct",
      suggestedPreset: "savings",
    });
    expect(snap.preset).toBe("performance");
    expect(snap.pinned).toBe(true);
    expect(snap.model).toBe("claude-opus-5-5");
  });

  it("colours budget warn/over from preset caps", () => {
    expect(budgetTone("balanced", 0.4)).toBe("ok");
    expect(budgetTone("balanced", 0.5)).toBe("warn");
    expect(budgetTone("balanced", 0.6)).toBe("over");
    expect(budgetTone("max", 25)).toBe("warn");
    expect(budgetTone("max", 50)).toBe("over");
  });
});
