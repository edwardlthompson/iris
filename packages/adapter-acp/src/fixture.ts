import { randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";
import { NdjsonRpc, type JsonRpcId, type JsonRpcMessage } from "./rpc.js";

export type FixtureOptions = {
  streamDelayMs?: number;
  requireApproval?: boolean;
  elicit?: boolean;
};

/** In-process ACP fixture: streams, elicits, tool approval, cancel. */
export class FixtureAgent {
  private readonly rpc: NdjsonRpc;
  private readonly sessions = new Map<string, { cancelled: boolean }>();
  private ready = false;
  private readonly streamDelayMs: number;
  private readonly requireApproval: boolean;
  private readonly elicit: boolean;

  constructor(stdin: Readable, stdout: Writable, opts: FixtureOptions = {}) {
    this.streamDelayMs = opts.streamDelayMs ?? 5;
    this.requireApproval = opts.requireApproval ?? true;
    this.elicit = opts.elicit ?? false;
    this.rpc = new NdjsonRpc(stdout, stdin);
    this.rpc.on("message", (msg: JsonRpcMessage) => void this.onMessage(msg));
  }

  close(): void {
    this.rpc.close();
  }

  private async onMessage(msg: JsonRpcMessage): Promise<void> {
    if (msg.method === "session/cancel") {
      const sid = (msg.params as { sessionId?: string } | undefined)?.sessionId;
      const s = sid ? this.sessions.get(sid) : undefined;
      if (s) s.cancelled = true;
      return;
    }
    if (msg.id === undefined || msg.id === null || !msg.method) return;
    try {
      await this.dispatch(msg.id, msg.method, msg);
    } catch (err) {
      this.rpc.respondError(msg.id, -32603, err instanceof Error ? err.message : String(err));
    }
  }

  private async dispatch(id: JsonRpcId, method: string, msg: JsonRpcMessage): Promise<void> {
    if (method === "initialize") {
      this.ready = true;
      this.rpc.respond(id, {
        protocolVersion: 1,
        capabilities: { session: { prompt: {}, mcp: {} }, baseUrlOverride: true },
        info: { name: "iris-fixture-agent", version: "0.0.0" },
        authMethods: [],
      });
      return;
    }
    if (!this.ready) {
      this.rpc.respondError(id, -32600, "not initialized");
      return;
    }
    if (method === "session/new") {
      const sessionId = `sess_${randomUUID().slice(0, 8)}`;
      this.sessions.set(sessionId, { cancelled: false });
      this.rpc.respond(id, { sessionId });
      return;
    }
    if (method === "session/prompt") {
      await this.handlePrompt(id, msg);
      return;
    }
    this.rpc.respondError(id, -32601, `method not found: ${method}`);
  }

  private async handlePrompt(id: JsonRpcId, msg: JsonRpcMessage): Promise<void> {
    const params = msg.params as {
      sessionId: string;
      prompt: Array<{ type: string; text?: string }>;
    };
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      this.rpc.respondError(id, -32000, "unknown session");
      return;
    }
    const text = params.prompt.find((p) => p.type === "text")?.text ?? "";
    await this.emitUpdate(params.sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: `echo:${text}` },
    });
    if (await this.stopIfCancelled(id, session)) return;
    if (this.elicit) {
      await this.rpc.request("session/elicitation", {
        sessionId: params.sessionId,
        message: "Confirm proceed?",
      });
    }
    if (await this.stopIfCancelled(id, session)) return;
    if (this.requireApproval) {
      const toolCallId = `tool_${randomUUID().slice(0, 6)}`;
      await this.emitUpdate(params.sessionId, {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "run_tests",
        status: "pending",
      });
      await this.rpc.request("session/request_permission", {
        sessionId: params.sessionId,
        toolCall: { toolCallId, title: "run_tests", kind: "execute" },
      });
    }
    if (await this.stopIfCancelled(id, session)) return;
    await this.emitUpdate(params.sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: " done" },
    });
    this.rpc.respond(id, { stopReason: "end_turn" });
  }

  private async stopIfCancelled(id: JsonRpcId, session: { cancelled: boolean }): Promise<boolean> {
    if (!session.cancelled) return false;
    this.rpc.respond(id, { stopReason: "cancelled" });
    return true;
  }

  private async emitUpdate(sessionId: string, update: Record<string, unknown>): Promise<void> {
    await new Promise((r) => setTimeout(r, this.streamDelayMs));
    this.rpc.notify("session/update", { sessionId, update });
  }
}
