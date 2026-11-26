import { connectCdp } from "./cdp.js";

const BUSY = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  if ([...document.querySelectorAll('.composer-button-area .codicon-debug-stop, .send-with-mode .codicon-debug-stop')].some(vis)) return true;
  if ([...document.querySelectorAll('button[aria-label]')].some((e) => {
    if (!vis(e)) return false;
    return /^(Stop generation|Stop(\\s|$| Ctrl))/i.test(e.getAttribute('aria-label') || '');
  })) return true;
  if ([...document.querySelectorAll('.agent-transcript-tail-status')].some((e) => {
    if (!vis(e)) return false;
    return /\\bRunning\\b/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || ''));
  })) return true;
  return false;
})()`;

/** True while an Agent composer on this CDP port shows Stop or Running. */
export async function cdpAgentBusy(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 700);
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const pages = (await res.json()) as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
    const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) return false;
    const session = await connectCdp(page.webSocketDebuggerUrl);
    try {
      return (await session.evaluate(BUSY)) === true;
    } finally {
      session.close();
    }
  } catch {
    return false;
  }
}

/** True while Cursor's Agent composer shows Stop or Running. */
export async function cursorAgentBusy(): Promise<boolean> {
  return cdpAgentBusy(9222);
}
