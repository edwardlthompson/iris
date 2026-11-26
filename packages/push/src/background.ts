import { EventEmitter } from "node:events";
import type { ApprovalPush } from "./providers.js";
import { approvalDeepLink } from "./deeplink.js";

export type AppLifecycle = "foreground" | "background";

/**
 * Background socket stub: while backgrounded, inbound approval pushes
 * navigate to the deep-linked thread/approval sheet.
 */
export class BackgroundApprovalSocket extends EventEmitter {
  lifecycle: AppLifecycle = "foreground";
  currentRoute: string | null = null;

  setLifecycle(state: AppLifecycle): void {
    this.lifecycle = state;
  }

  /** Simulate host pushing an approval while the app may be backgrounded. */
  receive(push: ApprovalPush): { routed: string; fromBackground: boolean } {
    const route = approvalDeepLink(push);
    const fromBackground = this.lifecycle === "background";
    this.currentRoute = route;
    this.emit("navigate", route, push);
    return { routed: route, fromBackground };
  }
}
