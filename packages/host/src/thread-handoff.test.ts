import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.IRIS_HOME = mkdtempSync(join(tmpdir(), "iris-handoff-"));
const { rememberTurn, withHandoff } = await import("./thread-handoff.js");

describe("cross-program handoff", () => {
  it("lets each later program see the earlier turns", () => {
    rememberTurn("cursor", "alpha token from cursor. Pairing code **692817**.", "submitted");
    const toAnti = withHandoff("beta token for antigravity");
    expect(toAnti).toContain("cursor user: alpha token from cursor");
    expect(toAnti).toContain("Iris repository lock");
    expect(toAnti).not.toContain("692817");
    rememberTurn("antigravity", "beta token for antigravity", "submitted");
    const toClaude = withHandoff("gamma token for claude");
    expect(toClaude).toContain("cursor user: alpha token from cursor");
    expect(toClaude).toContain("antigravity user: beta token for antigravity");
    rememberTurn("claude", "gamma token for claude", "submitted");
    const back = withHandoff("delta back to cursor");
    expect(back).toContain("claude user: gamma token for claude");
    expect(back).toContain("antigravity user: beta token for antigravity");
  });
});
