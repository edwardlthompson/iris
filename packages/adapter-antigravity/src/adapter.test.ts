import { describe, expect, it } from "vitest";
import { policyGate } from "@iris/router";
import { ANTIGRAVITY_CAPABILITIES } from "./capabilities.js";
import { AntigravityDriver } from "./driver.js";
import { processNameProbe, REASON_IDE_CLOSED, type IdeProbe } from "./ide.js";
import { AntigravitySession } from "./session.js";
import { candidacyFlags, probeLegStatus } from "./status.js";
import { readAntigravityActiveModel, selectAntigravityModel } from "./model-picker-cdp.js";

function fixedProbe(running: boolean): IdeProbe {
  return { isRunning: () => running };
}

describe("@iris/adapter-antigravity capabilities", () => {
  it("advertises headless:false (IDE required)", () => {
    expect(ANTIGRAVITY_CAPABILITIES.headless).toBe(false);
    expect(ANTIGRAVITY_CAPABILITIES.toolApproval).toBe(true);
  });
});

describe("@iris/adapter-antigravity status", () => {
  it("disables the leg with ide_closed when IDE is down", async () => {
    const status = await probeLegStatus(fixedProbe(false));
    expect(status).toEqual({ enabled: false, reason: REASON_IDE_CLOSED });
    expect(candidacyFlags(status)).toEqual({
      available: false,
      disabledReason: REASON_IDE_CLOSED,
    });
  });

  it("enables the leg when the IDE probe is true", async () => {
    const status = await probeLegStatus(fixedProbe(true));
    expect(status).toEqual({ enabled: true });
    expect(candidacyFlags(status).available).toBe(true);
  });

  it("processNameProbe matches Antigravity substrings", async () => {
    const probe = processNameProbe(() => ["chrome.exe", "Antigravity.exe"]);
    expect(await probe.isRunning()).toBe(true);
    const closed = processNameProbe(() => ["chrome.exe"]);
    expect(await closed.isRunning()).toBe(false);
  });
});

describe("@iris/adapter-antigravity driver + routing", () => {
  it("runs via the IDE bridge when open", async () => {
    const driver = new AntigravityDriver(fixedProbe(true), {
      async send(prompt) {
        return { text: `echo:${prompt}`, stopReason: "end_turn" };
      },
    });
    const session = new AntigravitySession({ driver });
    const result = await session.run("hi");
    expect(result.texts).toEqual(["echo:hi"]);
    expect(result.stopReason).toBe("end_turn");
  });

  it("refuses to run when the IDE is closed", async () => {
    const driver = new AntigravityDriver(fixedProbe(false), {
      async send() {
        return { text: "nope", stopReason: "end_turn" };
      },
    });
    await expect(driver.run("x")).rejects.toThrow(/ide_closed/);
  });

  it("closed IDE disables leg with reason; routing continues on other legs", async () => {
    const session = new AntigravitySession({
      driver: new AntigravityDriver(fixedProbe(false), {
        async send() {
          return { text: "", stopReason: "end_turn" };
        },
      }),
    });
    const flags = await session.candidacy();
    expect(flags.available).toBe(false);
    expect(flags.disabledReason).toBe(REASON_IDE_CLOSED);

    const gate = policyGate({
      topology: "direct",
      estUsd: 0.01,
      capOk: true,
      legs: [
        {
          id: "antigravity",
          hasCredentials: true,
          quotaOk: true,
          available: flags.available,
          disabledReason: flags.disabledReason,
        },
        { id: "claude", hasCredentials: true, quotaOk: true },
      ],
    });
    expect(gate).toEqual({ ok: true, legs: ["claude"] });
  });
});

describe("@iris/adapter-antigravity model picker exports", () => {
  it("exposes readAntigravityActiveModel and selectAntigravityModel", () => {
    expect(typeof readAntigravityActiveModel).toBe("function");
    expect(typeof selectAntigravityModel).toBe("function");
  });
});
