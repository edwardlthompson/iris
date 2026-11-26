import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";

export type JsonRpcId = string | number;

export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

/** Newline-delimited JSON-RPC 2.0 over a duplex pair (stdio). */
export class NdjsonRpc extends EventEmitter {
  private readonly pending = new Map<JsonRpcId, Pending>();
  private nextId = 1;
  private buffer = "";

  constructor(
    private readonly input: Writable,
    private readonly output: Readable,
  ) {
    super();
    this.output.setEncoding("utf8");
    this.output.on("data", (chunk: string) => this.onData(chunk));
    this.output.on("end", () => this.rejectAll(new Error("stdio closed")));
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  respondError(id: JsonRpcId, code: number, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  close(): void {
    this.rejectAll(new Error("rpc closed"));
  }

  private write(msg: JsonRpcMessage): void {
    this.input.write(`${JSON.stringify(msg)}\n`);
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line) as JsonRpcMessage;
      } catch {
        continue;
      }
      this.dispatch(msg);
    }
  }

  private dispatch(msg: JsonRpcMessage): void {
    if (msg.id !== undefined && msg.id !== null && (msg.result !== undefined || msg.error)) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
      } else {
        pending.resolve(msg.result);
      }
      return;
    }
    if (msg.method) {
      this.emit("message", msg);
    }
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }
}
