import { createServer, type Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { decodeFrame, encodeFrame, type RelayFrame } from "./frame.js";
import { selectActiveRung, type ActiveRung } from "./ladder.js";
import { backoffMs } from "./backoff.js";
import type { Discovery, HostAdvertisement } from "./discovery.js";

export interface RelayServerOpts {
  key: Uint8Array;
  discovery: Discovery;
  fingerprint: string;
  port?: number;
  host?: string;
}

export class RelayServer {
  #http: HttpServer | null = null;
  #wss: WebSocketServer | null = null;
  #port = 0;
  activeRung: ActiveRung | null = null;

  constructor(private readonly opts: RelayServerOpts) {}

  get port(): number {
    return this.#port;
  }

  async start(): Promise<this> {
    const host = this.opts.host ?? "127.0.0.1";
    this.#http = createServer();
    this.#wss = new WebSocketServer({ server: this.#http });
    this.#wss.on("connection", (ws) => this.#onConn(ws));
    await new Promise<void>((resolve) => {
      this.#http!.listen(this.opts.port ?? 0, host, () => resolve());
    });
    const addr = this.#http.address();
    this.#port = typeof addr === "object" && addr ? addr.port : 0;
    const endpoint = `ws://${host}:${this.#port}`;
    this.activeRung = selectActiveRung({ lan: endpoint });
    const ad: HostAdvertisement = {
      name: "iris-host",
      host,
      port: this.#port,
      fingerprint: this.opts.fingerprint,
    };
    await this.opts.discovery.advertise(ad);
    return this;
  }

  #onConn(ws: WebSocket): void {
    ws.on("message", (data) => {
      try {
        const buf =
          data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer);
        const frame = decodeFrame(this.opts.key, buf);
        if (frame.kind === "ping" || frame.kind === "hello" || frame.kind === "data") {
          const reply: RelayFrame = {
            v: 1,
            kind: frame.kind === "ping" ? "pong" : "data",
            seq: frame.seq,
            body: frame.body ?? "ack",
          };
          ws.send(encodeFrame(this.opts.key, reply));
        }
      } catch {
        ws.close(1008, "bad frame");
      }
    });
  }

  async stop(): Promise<void> {
    await this.opts.discovery.stop();
    await new Promise<void>((resolve) => this.#wss?.close(() => resolve()));
    await new Promise<void>((resolve) => this.#http?.close(() => resolve()));
    this.activeRung = null;
  }
}

export interface RelayClientOpts {
  key: Uint8Array;
  discovery: Discovery;
  fingerprint: string;
  maxAttempts?: number;
}

export class RelayClient {
  activeRung: ActiveRung | null = null;
  #ws: WebSocket | null = null;
  #seq = 0;

  constructor(private readonly opts: RelayClientOpts) {}

  async connect(): Promise<this> {
    const ads = await this.opts.discovery.browse();
    const match = ads.find((a) => a.fingerprint === this.opts.fingerprint);
    if (!match) throw new Error("host not found");
    const endpoint = `ws://${match.host}:${match.port}`;
    this.activeRung = selectActiveRung({ lan: endpoint });
    await this.#open(endpoint);
    return this;
  }

  async #open(endpoint: string): Promise<void> {
    const max = this.opts.maxAttempts ?? 5;
    let lastErr: unknown;
    for (let attempt = 0; attempt < max; attempt++) {
      try {
        this.#ws = await this.#once(endpoint);
        return;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  #once(endpoint: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);
      const t = setTimeout(() => {
        ws.close();
        reject(new Error("connect timeout"));
      }, 3_000);
      ws.once("open", () => {
        clearTimeout(t);
        resolve(ws);
      });
      ws.once("error", (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
  }

  /** Send and wait for a matching seq reply. */
  roundTrip(body: string): Promise<string> {
    const ws = this.#ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("not connected"));
    }
    const seq = ++this.#seq;
    return new Promise((resolve, reject) => {
      const onMsg = (data: WebSocket.RawData) => {
        try {
          const buf =
            data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(data as ArrayBuffer);
          const frame = decodeFrame(this.opts.key, buf);
          if (frame.seq === seq) {
            ws.off("message", onMsg);
            resolve(frame.body ?? "");
          }
        } catch (err) {
          ws.off("message", onMsg);
          reject(err);
        }
      };
      ws.on("message", onMsg);
      ws.send(encodeFrame(this.opts.key, { v: 1, kind: "data", seq, body }));
      setTimeout(() => {
        ws.off("message", onMsg);
        reject(new Error("round-trip timeout"));
      }, 3_000).unref?.();
    });
  }

  /** Drop the socket then reconnect with backoff (survives dropped socket). */
  async reconnectAfterDrop(): Promise<void> {
    this.#ws?.terminate();
    this.#ws = null;
    const ads = await this.opts.discovery.browse();
    const match = ads.find((a) => a.fingerprint === this.opts.fingerprint);
    if (!match) throw new Error("host not found after drop");
    await this.#open(`ws://${match.host}:${match.port}`);
  }

  async close(): Promise<void> {
    this.#ws?.close();
    this.#ws = null;
    this.activeRung = null;
  }
}
