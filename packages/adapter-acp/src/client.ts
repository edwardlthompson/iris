import type { Readable, Writable } from "node:stream";
import { EventEmitter } from "node:events";
import { NdjsonRpc, type JsonRpcId, type JsonRpcMessage } from "./rpc.js";
import { ACP_CAPABILITIES } from "./capabilities.js";
import type { Capabilities } from "@iris/protocol";

export type SessionUpdate = {
  sessionId: string;
  update: Record<string, unknown>;
};

export type PermissionRequest = {
  id: JsonRpcId;
  sessionId: string;
  toolCall: { toolCallId: string; title: string; kind?: string };
};

export type ElicitationRequest = {
  id: JsonRpcId;
  sessionId: string;
  message: string;
};

type InitResult = {
  protocolVersion: number;
  capabilities: Record<string, unknown>;
  info: { name: string; version: string };
};

/** ACP client: initialise → session → prompt / cancel; surfaces tools + elicitation. */
export class AcpClient extends EventEmitter {
  readonly capabilities: Capabilities = ACP_CAPABILITIES;
  private readonly rpc: NdjsonRpc;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(stdin: Writable, stdout: Readable) {
    super();
    this.rpc = new NdjsonRpc(stdin, stdout);
    this.rpc.on("message", (msg: JsonRpcMessage) => this.onAgentMessage(msg));
  }

  async initialize(): Promise<InitResult> {
    const result = (await this.rpc.request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "iris-adapter-acp", version: "0.0.0" },
      capabilities: { elicitation: {} },
    })) as InitResult;
    this.initialized = true;
    return result;
  }

  async newSession(cwd: string): Promise<string> {
    this.requireInit();
    const result = (await this.rpc.request("session/new", {
      cwd,
      mcpServers: [],
    })) as { sessionId: string };
    this.sessionId = result.sessionId;
    return result.sessionId;
  }

  async prompt(text: string): Promise<{ stopReason: string }> {
    this.requireSession();
    const result = (await this.rpc.request("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    })) as { stopReason: string };
    return result;
  }

  cancel(): void {
    this.requireSession();
    this.rpc.notify("session/cancel", { sessionId: this.sessionId });
  }

  allowTool(requestId: JsonRpcId): void {
    this.rpc.respond(requestId, { outcome: { outcome: "selected", optionId: "allow" } });
  }

  denyTool(requestId: JsonRpcId): void {
    this.rpc.respond(requestId, { outcome: { outcome: "selected", optionId: "reject" } });
  }

  answerElicitation(requestId: JsonRpcId, text: string): void {
    this.rpc.respond(requestId, { action: "accept", content: [{ type: "text", text }] });
  }

  get activeSessionId(): string | null {
    return this.sessionId;
  }

  close(): void {
    this.rpc.close();
  }

  private requireInit(): void {
    if (!this.initialized) throw new Error("call initialize first");
  }

  private requireSession(): void {
    this.requireInit();
    if (!this.sessionId) throw new Error("call newSession first");
  }

  private onAgentMessage(msg: JsonRpcMessage): void {
    if (msg.method === "session/update" && msg.params) {
      this.emit("update", msg.params as SessionUpdate);
      return;
    }
    if (msg.method === "session/request_permission" && msg.id !== undefined && msg.id !== null) {
      const p = msg.params as {
        sessionId: string;
        toolCall: PermissionRequest["toolCall"];
      };
      this.emit("permission", {
        id: msg.id,
        sessionId: p.sessionId,
        toolCall: p.toolCall,
      } satisfies PermissionRequest);
      return;
    }
    if (msg.method === "session/elicitation" && msg.id !== undefined && msg.id !== null) {
      const p = msg.params as { sessionId: string; message: string };
      this.emit("elicitation", {
        id: msg.id,
        sessionId: p.sessionId,
        message: p.message,
      } satisfies ElicitationRequest);
    }
  }
}
