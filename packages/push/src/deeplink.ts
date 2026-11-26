import type { ApprovalPush } from "./providers.js";

const SCHEME = "iris";

/** Deep link into the approval sheet for a thread. */
export function approvalDeepLink(payload: ApprovalPush): string {
  const q = new URLSearchParams({
    approval: payload.approvalId,
    thread: payload.threadId,
  });
  return `${SCHEME}://approval?${q.toString()}`;
}

export function parseApprovalDeepLink(url: string): ApprovalPush | null {
  try {
    const u = new URL(url);
    if (u.protocol !== `${SCHEME}:`) return null;
    if (u.hostname !== "approval" && u.pathname.replace(/^\//, "") !== "approval") {
      // iris://approval?... → hostname approval
      if (u.host !== "approval") return null;
    }
    const threadId = u.searchParams.get("thread");
    const approvalId = u.searchParams.get("approval");
    if (!threadId || !approvalId) return null;
    return { threadId, approvalId, title: "Approval" };
  } catch {
    return null;
  }
}
