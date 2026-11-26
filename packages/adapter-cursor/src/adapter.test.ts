import { describe, expect, it } from "vitest";
import { policyGate } from "@iris/router";
import { pickBestAvailable } from "@iris/router";
import { CURSOR_CAPABILITIES } from "./capabilities.js";
import { bestModelWithCredits, type CreditProbe } from "./credits.js";
import { CursorDriver } from "./driver.js";
import { REASON_IDE_CLOSED, REASON_NO_CREDITS, type IdeProbe } from "./ide.js";
import { candidacyFlags, probeCursorLeg } from "./status.js";

function probe(running: boolean): IdeProbe {
  return { isRunning: () => running };
}

function credits(models: Array<{ id: string; remainingPct: number; rank: number }>): CreditProbe {
  const remainingPct = Math.max(0, ...models.map((m) => m.remainingPct));
  return {
    snapshot: () => ({
      remainingPct,
      bestModel: bestModelWithCredits({ remainingPct, bestModel: null, models }),
      models,
    }),
  };
}

describe("@iris/adapter-cursor", () => {
  it("requires IDE and advertises non-headless", () => {
    expect(CURSOR_CAPABILITIES.headless).toBe(false);
  });

  it("disables when Cursor is closed", async () => {
    const s = await probeCursorLeg(
      probe(false),
      credits([{ id: "composer", remainingPct: 1, rank: 1 }]),
    );
    expect(s).toEqual({ enabled: false, reason: REASON_IDE_CLOSED });
  });

  it("picks best model that still has credits", async () => {
    const snap = credits([
      { id: "opus", remainingPct: 0, rank: 100 },
      { id: "sonnet", remainingPct: 0.2, rank: 50 },
      { id: "composer", remainingPct: 0.9, rank: 40 },
    ]).snapshot() as {
      remainingPct: number;
      bestModel: string | null;
      models: Array<{ id: string; remainingPct: number; rank: number }>;
    };
    expect(bestModelWithCredits(snap)).toBe("sonnet");
    const s = await probeCursorLeg(probe(true), {
      snapshot: () => snap,
    });
    expect(s.enabled).toBe(true);
    if (s.enabled) expect(s.model).toBe("sonnet");
  });

  it("disables with no_credits when all models exhausted", async () => {
    const s = await probeCursorLeg(
      probe(true),
      credits([
        { id: "opus", remainingPct: 0, rank: 100 },
        { id: "sonnet", remainingPct: 0, rank: 50 },
      ]),
    );
    expect(s.enabled).toBe(false);
    if (!s.enabled) expect(s.reason).toBe(REASON_NO_CREDITS);
  });

  it("runs via bridge on the credited model", async () => {
    const driver = new CursorDriver(
      probe(true),
      credits([{ id: "composer", remainingPct: 1, rank: 10 }]),
      {
        async send({ prompt, model }) {
          return { text: `${model}:${prompt}`, stopReason: "end_turn" };
        },
      },
    );
    const out = await driver.run("hi");
    expect(out.text).toBe("composer:hi");
  });

  it("feeds policyGate and pickBestAvailable for Cursor-only inventory", async () => {
    const status = await probeCursorLeg(
      probe(true),
      credits([{ id: "composer", remainingPct: 0.5, rank: 10 }]),
    );
    const flags = candidacyFlags(status);
    const gate = policyGate({
      topology: "direct",
      estUsd: 0.01,
      capOk: true,
      legs: [
        {
          id: "claude",
          hasCredentials: true,
          quotaOk: false,
          available: true,
          disabledReason: REASON_NO_CREDITS,
        },
        {
          id: "cursor",
          hasCredentials: true,
          quotaOk: flags.quotaOk,
          available: flags.available,
        },
      ],
    });
    expect(gate).toEqual({ ok: true, legs: ["cursor"] });
    expect(
      pickBestAvailable([
        { id: "claude", hasCredentials: true, quotaOk: false, rank: 100 },
        { id: "cursor", hasCredentials: true, quotaOk: true, available: true, rank: 40 },
      ]),
    ).toBe("cursor");
  });
});
