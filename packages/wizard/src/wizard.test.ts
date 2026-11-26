import { describe, expect, it } from "vitest";
import { advanceWizard, initialWizardState, wizardComplete, type Pairer } from "./first-run.js";

function mockPairer(code: string): Pairer {
  return {
    hostFingerprint: () => code,
    pair(presented) {
      if (presented !== code) return { ok: false, reason: "fingerprint_mismatch" };
      return { ok: true, sessionId: "pair_test" };
    },
  };
}

describe("@iris/wizard first-run", () => {
  it("completes pairing then finishes on direct topology", () => {
    const pairer = mockPairer("123456");
    let s = initialWizardState();
    s = advanceWizard(s, { type: "next" });
    expect(s.step).toBe("pair");
    s = advanceWizard(s, { type: "pair", code: "123456", pairer });
    expect(s.sessionId).toBe("pair_test");
    s = advanceWizard(s, { type: "setTopology", topology: "direct" });
    s = advanceWizard(s, { type: "next" });
    expect(s.step).toBe("done");
    expect(wizardComplete(s)).toBe(true);
    expect(s.includeLiteLlm).toBe(false);
  });

  it("offers LiteLLM only for pool topology", () => {
    const pairer = mockPairer("999999");
    let s = initialWizardState();
    s = advanceWizard(s, { type: "next" });
    s = advanceWizard(s, { type: "pair", code: "999999", pairer });
    s = advanceWizard(s, { type: "setTopology", topology: "pool" });
    s = advanceWizard(s, { type: "next" });
    expect(s.step).toBe("litellm");
    s = advanceWizard(s, { type: "setLiteLlm", include: true });
    s = advanceWizard(s, { type: "next" });
    expect(wizardComplete(s)).toBe(true);
    expect(s.includeLiteLlm).toBe(true);
  });

  it("refuses wrong fingerprint", () => {
    const pairer = mockPairer("111111");
    let s = advanceWizard(initialWizardState(), { type: "next" });
    s = advanceWizard(s, { type: "pair", code: "000000", pairer });
    expect(s.error).toBe("fingerprint_mismatch");
    expect(wizardComplete(s)).toBe(false);
  });
});
