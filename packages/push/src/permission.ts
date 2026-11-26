export type PermissionStatus = "prompt" | "granted" | "denied";

export type PermissionBridge = {
  getStatus(): PermissionStatus | Promise<PermissionStatus>;
  request(): Promise<PermissionStatus>;
};

export async function ensurePushPermission(bridge: PermissionBridge): Promise<PermissionStatus> {
  const current = await bridge.getStatus();
  if (current === "granted" || current === "denied") return current;
  return bridge.request();
}
