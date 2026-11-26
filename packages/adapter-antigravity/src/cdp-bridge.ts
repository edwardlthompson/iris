/** Drive Antigravity's composer over CDP. The IDE must be launched with --remote-debugging-port=9000. */

const CDP_HTTP = "http://127.0.0.1:9000";

const FOCUS = `(() => {
  const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const selectors = [
    '[data-testid="agent-input-box"] [contenteditable="true"]',
    '[aria-label="Message input"][contenteditable="true"]',
    '[data-testid="composer-input"]',
    '.antigravity-agent-side-panel [contenteditable="true"]',
    '.interactive-input-part [contenteditable="true"]',
    '.aislash-editor-input[contenteditable="true"]',
    '.ui-prompt-input-editor__input[contenteditable="true"]',
    '.composer-bar [contenteditable="true"]',
    '.auxiliarybar [contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]'
  ];
  let eds = [];
  for (const s of selectors) { eds = [...document.querySelectorAll(s)].filter(visible); if (eds.length) break; }
  if (!eds.length) return false;
  const el = eds[eds.length - 1];
  el.focus();
  return true;
})()`;

type Session = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  close(): void;
};

async function connect(wsUrl: string): Promise<Session> {
  const { connectCdp } = await import("@iris/adapter-cursor");
  return connectCdp(wsUrl);
}

async function listPages(cdpHttp: string): Promise<{ ws: string; title: string }[]> {
  const res = await fetch(`${cdpHttp}/json/list`);
  if (!res.ok) throw new Error(`Antigravity CDP list failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ type?: string; title?: string; url?: string; webSocketDebuggerUrl?: string }>;
  return rows
    .filter((t) => t.type === "page" && t.webSocketDebuggerUrl && (/antigravity/i.test(t.title || "") || /:7881|workbench/i.test(t.url || "")))
    .map((t) => ({ ws: t.webSocketDebuggerUrl!, title: t.title || "Antigravity" }));
}

async function pressEnter(session: Session): Promise<void> {
  const ev = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", ...ev });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...ev });
}

const HISTORY = `(() => {
  const rows = [...document.querySelectorAll('[data-testid="conversation-list-sidebar"] [data-testid="conversation-row-sidebar"]')];
  return rows.map((e, i) => ({
    id: e.getAttribute("data-conversation-id") || e.getAttribute("data-id") || String(i),
    title: (e.innerText || "").trim().split("\\n")[0].slice(0, 80),
    project: "antigravity",
    mtimeMs: 0,
  })).filter((r) => r.title);
})()`;

const TABS = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const nameOf = (t) => (t.getAttribute("aria-label") || t.innerText || "").trim().replace(/\\s+/g, " ").replace(/\\s*[●*].*$/, "").trim();
  return [...document.querySelectorAll(".agy-aux-tab, .ui-tab-system-tab, .tabs-container .tab")].filter(vis).map((t) => {
    const name = nameOf(t);
    if (!name || !/\\.\\w{1,16}$/.test(name)) return null;
    return { name, label: t.getAttribute("aria-label") || name, active: t.getAttribute("aria-selected") === "true", dirty: false };
  }).filter(Boolean);
})()`;

async function withPage<T>(cdpHttp: string, fn: (s: Session) => Promise<T>): Promise<T> {
  const page = (await listPages(cdpHttp))[0];
  if (!page) throw new Error("antigravity disabled: ide_closed");
  const session = await connect(page.ws);
  try {
    return await fn(session);
  } finally {
    session.close();
  }
}

export async function listAntigravityHistory(cdpHttp = CDP_HTTP) {
  const rows = await withPage(cdpHttp, (s) => s.evaluate(HISTORY));
  return Array.isArray(rows) ? rows as { id: string; title: string; project: string; mtimeMs: number }[] : [];
}

export async function listAntigravityEditors(cdpHttp = CDP_HTTP) {
  const tabs = await withPage(cdpHttp, (s) => s.evaluate(TABS));
  return Array.isArray(tabs) ? tabs as { name: string; label: string; active: boolean; dirty: boolean }[] : [];
}

export async function focusAntigravityEditor(name: string, cdpHttp = CDP_HTTP): Promise<boolean> {
  const expr = `(() => {
    const want = ${JSON.stringify(name)};
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
    const tabs = [...document.querySelectorAll(".agy-aux-tab, .ui-tab-system-tab, .tabs-container .tab")].filter(vis);
    const t = tabs.find((e) => (e.getAttribute("aria-label") || e.innerText || "").includes(want));
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`;
  return withPage(cdpHttp, async (s) => {
    const pos = (await s.evaluate(expr)) as { x: number; y: number } | null;
    if (!pos) return false;
    for (const type of ["mousePressed", "mouseReleased"] as const) {
      await s.send("Input.dispatchMouseEvent", { type, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    }
    return true;
  });
}

const QUOTA = `(() => {
  const csrf = localStorage.getItem("agy_session_csrf_token") || "";
  if (!csrf) return null;
  return fetch("/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Connect-Protocol-Version": "1", "X-Codeium-Csrf-Token": csrf },
    body: "{}",
    credentials: "include",
  }).then((r) => r.ok ? r.json() : null).catch(() => null);
})()`;

type AgProduct = {
  id: string;
  program: "antigravity";
  label: string;
  name: string;
  models: string;
  h5Left: number | null;
  d7Left: number | null;
  h5Disabled: boolean;
  reset5h: string | null;
  reset7d: string | null;
};

function resetIn(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Full";
  const mins = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins % 60}m`;
}

/** Google quota groups: Gemini, Claude/GPT, Argon, each with a 5h and 7d bucket. */
export async function scrapeAntigravityUsage(cdpHttp = CDP_HTTP): Promise<AgProduct[]> {
  try {
    const summary = await withPage(cdpHttp, (s) => s.evaluate(QUOTA)) as {
      groups?: Array<Record<string, unknown>>;
      response?: { groups?: Array<Record<string, unknown>> };
    } | null;
    const groups = summary?.response?.groups || summary?.groups;
    if (!Array.isArray(groups)) return [];
    return groups.map((g) => {
      const name = String(g.displayName || "Model group");
      const buckets = Array.isArray(g.buckets) ? g.buckets as Array<Record<string, unknown>> : [];
      const b7 = buckets.find((b) => b.window === "weekly" || /weekly/i.test(String(b.bucketId || b.displayName || "")));
      const b5 = buckets.find((b) => b.window === "5h" || /5h/i.test(String(b.bucketId || b.displayName || "")));
      const pct = (b: Record<string, unknown> | undefined) =>
        b && b.remainingFraction != null ? Math.max(0, Math.min(100, Math.round(Number(b.remainingFraction) * 100))) : null;
      const short = /argon/i.test(name) ? "Argon" : /claude|gpt/i.test(name) ? "Claude/GPT" : /gemini/i.test(name) ? "Gemini" : name.slice(0, 16);
      return {
        id: `ag-${short.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
        program: "antigravity" as const,
        label: "Antigravity",
        name: `Antigravity · ${short}`,
        models: String(g.description || short).replace(/^Models within this group:\s*/i, ""),
        h5Left: pct(b5),
        d7Left: pct(b7),
        h5Disabled: Boolean(b5?.disabled),
        reset5h: b5?.disabled ? "Weekly cap" : resetIn(b5?.resetTime),
        reset7d: resetIn(b7?.resetTime),
      };
    });
  } catch {
    return [];
  }
}

/** Type a prompt into the Antigravity composer and submit it. */
export async function submitAntigravityPrompt(
  prompt: string,
  cdpHttp = CDP_HTTP,
): Promise<{ text: string; stopReason: string }> {
  const pages = await listPages(cdpHttp);
  const page = pages[0];
  if (!page) throw new Error("antigravity disabled: ide_closed");
  const session = await connect(page.ws);
  try {
    const found = await session.evaluate(FOCUS);
    if (!found) throw new Error("antigravity composer not found");
    await session.send("Input.insertText", { text: prompt });
    await pressEnter(session);
    return { text: "", stopReason: "submitted" };
  } finally {
    session.close();
  }
}
