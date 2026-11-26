import { describe, expect, it } from "vitest";
import { ensurePushPermission, type PermissionBridge } from "./permission.js";
import { memoryTransporter } from "./providers.js";
import { approvalDeepLink, parseApprovalDeepLink } from "./deeplink.js";
import { BackgroundApprovalSocket } from "./background.js";

describe("@iris/push Sprint 18", () => {
  it("runs permission flow prompt → granted", async () => {
    let status: "prompt" | "granted" | "denied" = "prompt";
    const bridge: PermissionBridge = {
      getStatus: () => status,
      async request() {
        status = "granted";
        return status;
      },
    };
    expect(await ensurePushPermission(bridge)).toBe("granted");
  });

  it("registers APNs and FCM devices and sends approvals", async () => {
    const t = memoryTransporter();
    await t.register({ provider: "apns", token: "ios-1" });
    await t.register({ provider: "fcm", token: "and-1" });
    await t.sendApproval(
      { provider: "apns", token: "ios-1" },
      { threadId: "th1", approvalId: "ap1", title: "Allow Bash?" },
    );
    expect(t.sent[0]?.threadId).toBe("th1");
  });

  it("deep-links to the approval sheet", () => {
    const link = approvalDeepLink({
      threadId: "th9",
      approvalId: "ap9",
      title: "x",
    });
    expect(link).toContain("iris://approval");
    expect(parseApprovalDeepLink(link)?.threadId).toBe("th9");
  });

  it("backgrounded app lands on the right thread", () => {
    const sock = new BackgroundApprovalSocket();
    sock.setLifecycle("background");
    const result = sock.receive({
      threadId: "thread_42",
      approvalId: "approve_7",
      title: "Tool approval",
    });
    expect(result.fromBackground).toBe(true);
    expect(result.routed).toContain("thread=thread_42");
    expect(result.routed).toContain("approval=approve_7");
    expect(sock.currentRoute).toBe(result.routed);
  });
});
