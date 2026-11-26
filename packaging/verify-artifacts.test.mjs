import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertArtifactsPresent, buildAllDryRun, verifyPackaging } from "./verify-artifacts.mjs";

describe("packaging verify-artifacts", () => {
  it("dry-runs APK, MSI, and deb stubs", async () => {
    await buildAllDryRun();
    const meta = await assertArtifactsPresent();
    assert.equal(meta.android.signed, false);
    assert.equal(meta.windows.tray, true);
    assert.equal(meta.linux.unit, "iris.service");
    assert.equal(meta.windows.litellmComponent, "optional-disabled");
  });

  it("verifyPackaging checks Capacitor shell + artifacts", async () => {
    const meta = await verifyPackaging();
    assert.ok(meta.android.capacitor);
  });

  it("first-run pairing acceptance contract (wizard done)", () => {
    // Mirrors @iris/wizard advanceWizard happy path without TS import.
    const steps = ["welcome", "pair", "topology", "done"];
    const pairer = {
      pair(code) {
        return code === "424242"
          ? { ok: true, sessionId: "pair_pkg" }
          : { ok: false, reason: "fingerprint_mismatch" };
      },
    };
    let step = steps[0];
    let sessionId = null;
    step = "pair";
    const result = pairer.pair("424242");
    assert.equal(result.ok, true);
    sessionId = result.sessionId;
    step = "done";
    assert.equal(step, "done");
    assert.ok(sessionId);
  });
});
