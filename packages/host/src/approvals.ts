/** Phone Allow/Deny resumes a host-side tool approval (Cursor canUseTool shape). */

type Waiter = (decision: string) => void;

const pending = new Map<string, Waiter>();

export function requestPhoneApproval(
  id: string,
  send: (labels: string[]) => void,
  labels = ["Allow", "Deny"],
): Promise<string> {
  send(labels);
  return new Promise((resolve) => {
    pending.set(id, resolve);
  });
}

export function settleApproval(id: string, decision: string): boolean {
  const wait = pending.get(id);
  if (!wait) return false;
  pending.delete(id);
  wait(decision);
  return true;
}
