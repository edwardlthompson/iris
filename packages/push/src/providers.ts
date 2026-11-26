import { z } from "zod";

export const PushProviderSchema = z.enum(["apns", "fcm"]);
export type PushProvider = z.infer<typeof PushProviderSchema>;

export type DeviceToken = {
  provider: PushProvider;
  token: string;
};

export type ApprovalPush = {
  threadId: string;
  approvalId: string;
  title: string;
};

/** FOSS stub transporters — real APNs/FCM wire-up is packaging-time. */
export type PushTransporter = {
  register(device: DeviceToken): Promise<void>;
  sendApproval(device: DeviceToken, payload: ApprovalPush): Promise<{ ok: true }>;
};

export function memoryTransporter(): PushTransporter & { sent: ApprovalPush[] } {
  const sent: ApprovalPush[] = [];
  const tokens = new Set<string>();
  return {
    sent,
    async register(device) {
      tokens.add(`${device.provider}:${device.token}`);
    },
    async sendApproval(device, payload) {
      if (!tokens.has(`${device.provider}:${device.token}`)) {
        throw new Error("device_not_registered");
      }
      sent.push(payload);
      return { ok: true };
    },
  };
}
