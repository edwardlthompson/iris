/** Antigravity CDP model picker (port 9000): reads active model & switches via menu + effort submenu. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type CdpSession = {
  send(m: string, p?: Record<string, unknown>): Promise<unknown>;
  evaluate(e: string): Promise<unknown>;
  close(): void;
};

async function openMainPage(cdpHttp: string): Promise<CdpSession | null> {
  const res = await fetch(`${cdpHttp}/json/list`).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as Array<{
    type?: string;
    title?: string;
    url?: string;
    webSocketDebuggerUrl?: string;
  }>;
  const page = rows.find(
    (t) =>
      t.type === "page" &&
      t.webSocketDebuggerUrl &&
      (/antigravity/i.test(t.title || "") || /:7881|workbench/i.test(t.url || "")),
  );
  if (!page?.webSocketDebuggerUrl) return null;
  const { connectCdp } = await import("@iris/adapter-cursor");
  return connectCdp(page.webSocketDebuggerUrl);
}

async function tap(s: CdpSession, x: number, y: number): Promise<void> {
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await s.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await s.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
}

async function sendEsc(s: CdpSession): Promise<void> {
  for (const type of ["keyDown", "keyUp"] as const) {
    await s.send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
  }
}

function normEffort(effort?: string): string {
  const e = (effort || "").toLowerCase();
  if (e === "low") return "Low";
  if (e === "high" || e === "xhigh" || e === "max") return "High";
  return "Medium";
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/^Select model,\s*current:\s*/i, "")
    .replace(/\. Applies to.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TRIGGER_EXPR = `(() => {
  const b = [...document.querySelectorAll("button")].find(e => (e.getAttribute("aria-label") || "").startsWith("Select model"));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, aria: b.getAttribute("aria-label") || "", text: (b.innerText || "").trim() };
})()`;

export async function readAntigravityActiveModel(
  cdpHttp = "http://127.0.0.1:9000",
): Promise<string | null> {
  const s = await openMainPage(cdpHttp).catch(() => null);
  if (!s) return null;
  try {
    const trig = (await s.evaluate(TRIGGER_EXPR)) as { aria?: string; text?: string } | null;
    if (!trig) return null;
    const label = cleanLabel(trig.aria || trig.text || "");
    return label || null;
  } catch {
    return null;
  } finally {
    s.close();
  }
}

export async function selectAntigravityModel(
  opts: { pickerLabel: string; effort?: string },
  cdpHttp = "http://127.0.0.1:9000",
): Promise<{ ok: boolean; activeModel: string | null; detail: string }> {
  const wantEffort = normEffort(opts.effort);
  const wantBase = opts.pickerLabel.trim();
  const s = await openMainPage(cdpHttp).catch(() => null);
  if (!s) return { ok: false, activeModel: null, detail: "antigravity_cdp_closed" };
  try {
    await s.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    const trig = (await s.evaluate(TRIGGER_EXPR)) as {
      x: number;
      y: number;
      aria: string;
      text: string;
    } | null;
    if (!trig) return { ok: false, activeModel: null, detail: "model_trigger_not_found" };
    const current = cleanLabel(trig.aria || trig.text);
    const curLower = current.toLowerCase();
    const baseLower = wantBase.toLowerCase();
    const allowOrch = baseLower.includes("orchestrator");
    if (
      curLower.includes(baseLower) &&
      (allowOrch || !curLower.includes("orchestrator")) &&
      curLower.includes(wantEffort.toLowerCase())
    ) {
      return { ok: true, activeModel: current, detail: "already_selected" };
    }

    await tap(s, trig.x, trig.y);
    await sleep(350);

    const row = (await s.evaluate(`(() => {
      const want = ${JSON.stringify(baseLower)};
      const allowOrch = ${JSON.stringify(allowOrch)};
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 10 && r.height > 10; };
      const items = [...document.querySelectorAll("[role=menuitem]")].filter(vis);
      const hit = items.find(el => {
        const base = (el.querySelector("[data-model-base]")?.getAttribute("data-model-base") || "").toLowerCase();
        const txt = (el.innerText || "").toLowerCase();
        if (!allowOrch && txt.includes("orchestrator") && !base.includes("orchestrator")) return false;
        return base === want || base.includes(want) || txt.includes(want);
      });
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, hasSub: hit.getAttribute("aria-haspopup") === "menu" };
    })()`)) as { x: number; y: number; hasSub: boolean } | null;

    if (!row) {
      await sendEsc(s);
      return { ok: false, activeModel: current, detail: `model_not_found:${wantBase}` };
    }

    if (row.hasSub) {
      await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: row.x, y: row.y });
      await sleep(350);
      const sub = (await s.evaluate(`(() => {
        const want = ${JSON.stringify(wantEffort.toLowerCase())};
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 10 && r.height > 10; };
        const menus = [...document.querySelectorAll("[role=menu]")].filter(vis);
        const subMenu = menus[menus.length - 1];
        if (!subMenu) return null;
        const items = [...subMenu.querySelectorAll("[role=menuitem],[role=menuitemradio]")].filter(vis);
        const hit = items.find(el => (el.innerText || "").trim().toLowerCase() === want)
          || items.find(el => (el.innerText || "").trim().toLowerCase().startsWith(want));
        if (!hit) return null;
        const r = hit.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`)) as { x: number; y: number } | null;
      await tap(s, sub ? sub.x : row.x, sub ? sub.y : row.y);
    } else {
      await tap(s, row.x, row.y);
    }

    await sleep(250);
    await sendEsc(s).catch(() => {});
    const after = (await s.evaluate(TRIGGER_EXPR)) as { aria?: string; text?: string } | null;
    const activeModel = after ? cleanLabel(after.aria || after.text || "") : current;
    const ok = Boolean(activeModel && activeModel.toLowerCase().includes(baseLower));
    return {
      ok,
      activeModel,
      detail: ok ? `${wantBase} ${wantEffort}` : `select_unconfirmed:${activeModel || ""}`,
    };
  } catch (err) {
    await sendEsc(s).catch(() => {});
    return {
      ok: false,
      activeModel: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    s.close();
  }
}
