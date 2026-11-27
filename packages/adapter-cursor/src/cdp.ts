/** Minimal Chrome DevTools Protocol client for Cursor workbench pages. */

export type CdpTarget = { id: string; title: string; ws: string };

export type CdpSession = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  close(): void;
};

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export async function listWorkbenchTargets(
  cdpHttp = "http://127.0.0.1:9222",
): Promise<CdpTarget[]> {
  const res = await fetch(`${cdpHttp.replace(/\/$/, "")}/json/list`);
  if (!res.ok) throw new Error(`CDP list failed: ${res.status}`);
  const targets = (await res.json()) as Array<{
    id: string;
    title?: string;
    type?: string;
    url?: string;
    webSocketDebuggerUrl?: string;
  }>;
  return targets
    .filter((t) => t.type === "page" && t.webSocketDebuggerUrl && /workbench/i.test(t.url || ""))
    .map((t) => ({
      id: t.id,
      title: t.title || "Cursor",
      ws: t.webSocketDebuggerUrl!,
    }));
}

/** Prefer the Agents window, else first workbench page. */
export function pickAgentsTarget(targets: CdpTarget[]): CdpTarget | null {
  if (!targets.length) return null;
  return targets.find((t) => /agents/i.test(t.title)) ?? targets[0] ?? null;
}

export function connectCdp(wsUrl: string, timeoutMs = 8000): Promise<CdpSession> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map<number, Pending>();
    let nextId = 0;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("CDP connect timeout"));
    }, timeoutMs);

    const session: CdpSession = {
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++nextId;
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      async evaluate(expression) {
        const r = (await session.send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        })) as {
          result?: { value?: unknown };
          exceptionDetails?: { exception?: { description?: string } };
        };
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.exception?.description || "evaluate failed");
        }
        return r.result?.value;
      },
      close() {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      },
    };

    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(session);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`CDP connect failed: ${wsUrl}`));
    });
    ws.addEventListener("message", (ev) => {
      let msg: { id?: number; result?: unknown; error?: { message?: string } };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!msg.id || !pending.has(msg.id)) return;
      const p = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || "CDP error"));
      else p.resolve(msg.result);
    });
    ws.addEventListener("close", () => {
      for (const p of pending.values()) p.reject(new Error("CDP closed"));
      pending.clear();
    });
  });
}
