import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planResume } from "./resume.js";
import { triggerQuotaHandoff } from "./trigger.js";
import { readHandoff, writeHandoff } from "./writer.js";

const base = {
  threadId: "th1",
  from: { leg: "claude", model: "sonnet" },
  goal: "ship feature",
  state: { files_touched: ["a.ts"], tests: "pending", last_error: "quota" },
  constraints: ["no public bind"],
  nextStep: "continue after quota reset",
  budget: { preset: "balanced" as const, cap_usd: 0.6 },
};

describe("@iris/handoff", () => {
  it("requires confirm and picks pool same-model fallback", () => {
    const denied = triggerQuotaHandoff({
      ...base,
      confirmed: false,
      topology: "pool",
      fallbacks: [{ leg: "claude", model: "opus", samePool: true }],
    });
    expect(denied.ok).toBe(false);

    const ok = triggerQuotaHandoff({
      ...base,
      confirmed: true,
      topology: "pool",
      fallbacks: [
        { leg: "other", model: "x" },
        { leg: "claude", model: "haiku", samePool: true },
      ],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.handoff.to).toEqual({ leg: "claude", model: "haiku" });
      expect(ok.handoff.reason).toBe("quota_exhausted");
    }
  });

  it("writes handoff and resumes with goal/state/constraints/next_step", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "iris-handoff-"));
    const triggered = triggerQuotaHandoff({
      ...base,
      confirmed: true,
      topology: "direct",
      fallbacks: [{ leg: "acp", model: "codex" }],
    });
    expect(triggered.ok).toBe(true);
    if (!triggered.ok) return;

    const written = await writeHandoff(dir, triggered.handoff);
    const loaded = await readHandoff(path.join(dir, "th1.handoff.v1.json"));
    expect(loaded).toEqual(written);

    const resume = planResume(loaded);
    expect(resume.goal).toBe("ship feature");
    expect(resume.state.files_touched).toEqual(["a.ts"]);
    expect(resume.constraints).toContain("no public bind");
    expect(resume.nextStep).toBe("continue after quota reset");
    expect(resume.leg).toBe("acp");
    expect(resume.model).toBe("codex");
  });
});
