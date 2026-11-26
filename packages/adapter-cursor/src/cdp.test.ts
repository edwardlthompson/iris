import { describe, expect, it } from "vitest";
import { pickAgentsTarget, type CdpTarget } from "./cdp.js";

describe("CDP target pick", () => {
  it("prefers Cursor Agents window", () => {
    const targets: CdpTarget[] = [
      { id: "1", title: "Iris — iris", ws: "ws://a" },
      { id: "2", title: "Cursor Agents", ws: "ws://b" },
    ];
    expect(pickAgentsTarget(targets)?.id).toBe("2");
  });

  it("falls back to first workbench when no Agents title", () => {
    const targets: CdpTarget[] = [{ id: "1", title: "Cursor", ws: "ws://a" }];
    expect(pickAgentsTarget(targets)?.id).toBe("1");
  });

  it("returns null when empty", () => {
    expect(pickAgentsTarget([])).toBeNull();
  });
});
