import { connectCdp, listWorkbenchTargets, pickAgentsTarget, type CdpSession } from "./cdp.js";
import type { GrokEffort } from "./models.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cursor Agents model picker (2026-11): Auto toggle hides model rows until disabled. */
const HELPERS = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const modelTrigger = () => {
    const text = [...document.querySelectorAll('.vscode-model-picker__trigger-text')].find(vis);
    if (text) {
      const btn = text.closest('button, [role=button]') || text;
      if (vis(btn)) return btn;
    }
    return [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis);
  };
  const menu = () => [...document.querySelectorAll('[data-testid=model-picker-menu]')].find(vis) || null;
  const modelRows = () => {
    const root = menu();
    if (!root) return [];
    return [...root.querySelectorAll('[role=menuitem][data-testid^=model-item-], .ui-menu__row[data-testid^=model-item-]')].filter(vis).map(e => ({
      el: e,
      id: e.dataset.testid || '',
      label: (e.innerText || '').trim().split('\\n')[0].replace(/\\s+/g, ' '),
      params: !!e.querySelector('[data-testid=parameter-edit-btn]'),
      checked: e.getAttribute('aria-checked') === 'true' || !!e.querySelector('.codicon-check, .ui-model-picker__item-right-section [class*=check]')
    }));
  };
  return {
    trigger: () => {
      const el = modelTrigger();
      if (!el) return null;
      return { ...center(el), text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 40) };
    },
    autoToggle: () => {
      const el = document.querySelector('[data-testid=auto-mode-toggle]');
      if (!el || !vis(el)) return null;
      return { ...center(el), checked: el.getAttribute('aria-checked') === 'true' };
    },
    menuOpen: () => !!menu(),
    rows: () => modelRows().map(({ el, ...rest }) => rest),
    rowAt: (labelSub) => {
      const want = String(labelSub).toLowerCase();
      const hit = modelRows().find(x =>
        x.label.toLowerCase().includes(want)
        || x.id.toLowerCase().includes(want.replace(/\\s+/g, '-').replace(/\\./g, '-'))
        || x.id.toLowerCase().includes(want.replace(/\\s+/g, '-'))
      );
      if (!hit) return null;
      hit.el.scrollIntoView({ block: 'nearest' });
      return { ...center(hit.el), id: hit.id, label: hit.label, params: hit.params, checked: hit.checked };
    },
    editAt: (id) => {
      const root = menu();
      if (!root) return null;
      const row = root.querySelector('[data-testid="' + CSS.escape(String(id)) + '"]');
      if (!row) return null;
      const b = row.querySelector('[data-testid=parameter-edit-btn]');
      return b && vis(b) ? center(b) : null;
    },
    paramAt: (want) => {
      const sub = [...document.querySelectorAll('[data-testid=parameter-submenu]')].find(vis)
        || [...document.querySelectorAll('[role=menu]')].filter(vis).pop();
      if (!sub) return null;
      const rows = [...sub.querySelectorAll('.ui-menu__row, .ui-menu__toggle-row, [role=menuitem]')].filter(vis);
      const w = String(want).toLowerCase();
      const hit = rows.find(r => {
        const t = (r.querySelector('.ui-menu__item-content') || r).innerText.trim().toLowerCase();
        return t === w || t.split(/\\s+/)[0] === w || t.includes(w);
      });
      return hit ? center(hit) : null;
    },
  };
})()`;

async function tap(session: CdpSession, x: number, y: number): Promise<void> {
  await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
}

async function escape(session: CdpSession): Promise<void> {
  await session.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await session.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
}

async function closeMenus(session: CdpSession): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const open = await session.evaluate(`${HELPERS}.menuOpen()`);
    if (!open) return;
    await escape(session);
    await sleep(120);
  }
}

async function ensureMenuOpen(session: CdpSession): Promise<boolean> {
  if (await session.evaluate(`${HELPERS}.menuOpen()`)) return true;
  const trigger = (await session.evaluate(`${HELPERS}.trigger()`)) as {
    x: number;
    y: number;
  } | null;
  if (!trigger) return false;
  await tap(session, trigger.x, trigger.y);
  await sleep(300);
  return !!(await session.evaluate(`${HELPERS}.menuOpen()`));
}

const EFFORT_LABELS: Record<GrokEffort, string[]> = {
  low: ["low"],
  medium: ["medium", "med"],
  high: ["high"],
  xhigh: ["xhigh", "extra high", "extra-high", "very high"],
};

/**
 * Disable Cursor Auto, pick model, set effort.
 */
export async function selectCursorModelEffort(
  session: CdpSession,
  opts: { pickerLabel: string; effort: GrokEffort },
): Promise<{ ok: boolean; detail: string }> {
  try {
    if (!(await ensureMenuOpen(session))) {
      return { ok: false, detail: "model picker trigger not found" };
    }

    const auto = (await session.evaluate(`${HELPERS}.autoToggle()`)) as {
      x: number;
      y: number;
      checked: boolean;
    } | null;
    if (auto?.checked) {
      await tap(session, auto.x, auto.y);
      await sleep(350);
      if (!(await ensureMenuOpen(session))) {
        return { ok: false, detail: "menu closed after disabling Auto" };
      }
    }

    let row: {
      x: number;
      y: number;
      id?: string;
      label?: string;
      params?: boolean;
      checked?: boolean;
    } | null = null;
    for (let i = 0; i < 12 && !row; i++) {
      await sleep(100);
      row = (await session.evaluate(
        `${HELPERS}.rowAt(${JSON.stringify(opts.pickerLabel)})`,
      )) as typeof row;
    }
    if (!row) {
      const rows = await session.evaluate(`${HELPERS}.rows()`);
      await closeMenus(session);
      return {
        ok: false,
        detail: `model not in list: ${opts.pickerLabel}; saw=${JSON.stringify(rows).slice(0, 400)}`,
      };
    }

    if (!row.checked) {
      await tap(session, row.x, row.y);
      await sleep(250);
    }

    // Effort via parameter edit when available
    if (row.params && row.id) {
      if (!(await ensureMenuOpen(session))) {
        // Selecting the model may close the menu; reopen
        await ensureMenuOpen(session);
      }
      const edit = (await session.evaluate(`${HELPERS}.editAt(${JSON.stringify(row.id)})`)) as {
        x: number;
        y: number;
      } | null;
      if (edit) {
        await tap(session, edit.x, edit.y);
        await sleep(280);
        let param: { x: number; y: number } | null = null;
        for (const want of EFFORT_LABELS[opts.effort]) {
          param = (await session.evaluate(
            `${HELPERS}.paramAt(${JSON.stringify(want)})`,
          )) as typeof param;
          if (param) break;
        }
        if (param) {
          await tap(session, param.x, param.y);
          await sleep(200);
        }
      }
    }

    await closeMenus(session);
    const after = (await session.evaluate(`${HELPERS}.trigger()`)) as { text?: string } | null;
    const text = after?.text || "";
    const okEffort = new RegExp(opts.effort, "i").test(text) || /grok/i.test(text);
    return {
      ok: okEffort || !!after,
      detail: `${opts.pickerLabel} · ${opts.effort}${text ? ` → ${text}` : ""}`,
    };
  } catch (e) {
    await closeMenus(session).catch(() => {});
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export type LiveModelRow = { id: string; label: string; rank: number; effort?: GrokEffort };

function effortOf(label: string): GrokEffort | null {
  const t = label.toLowerCase();
  if (/extra high|xhigh|very high/.test(t)) return "xhigh";
  if (/\bhigh\b/.test(t)) return "high";
  if (/\bmed/.test(t)) return "medium";
  if (/\blow\b/.test(t)) return "low";
  return null;
}

/** Map an open Cursor model menu into phone inventory rows. Grok efforts keep wire ids. */
export function modelsFromMenuRows(rows: { id?: string; label?: string }[]): LiveModelRow[] {
  const out: LiveModelRow[] = [];
  for (const row of rows) {
    const label = (row.label || "").trim();
    if (!label || /^auto$/i.test(label)) continue;
    const effort = /grok\s*4\.7/i.test(label) ? effortOf(label) : null;
    const id = effort
      ? `grok-4.7:${effort}`
      : (row.id || label)
          .replace(/^model-item-/, "")
          .replace(/\s+/g, "-")
          .slice(0, 80);
    if (out.some((m) => m.id === id)) continue;
    out.push({ id, label, rank: 0, ...(effort ? { effort } : {}) });
  }
  return out.map((m, i) => ({ ...m, rank: out.length - i }));
}

let modelCache: { at: number; models: LiveModelRow[] } | null = null;

/** Read the desktop model menu once, then cache. Falls back to null so the Grok ladder stays. */
export async function listCursorModels(
  cdpHttp = "http://127.0.0.1:9222",
): Promise<LiveModelRow[] | null> {
  if (modelCache && Date.now() - modelCache.at < 600_000 && modelCache.models.length)
    return modelCache.models;
  try {
    const target = pickAgentsTarget(await listWorkbenchTargets(cdpHttp));
    if (!target) return null;
    const session = await connectCdp(target.ws);
    try {
      if (!(await ensureMenuOpen(session))) return null;
      const auto = (await session.evaluate(`${HELPERS}.autoToggle()`)) as {
        x: number;
        y: number;
        checked: boolean;
      } | null;
      if (auto?.checked) {
        await tap(session, auto.x, auto.y);
        await sleep(350);
      }
      const rows = (await session.evaluate(`${HELPERS}.rows()`)) as {
        id?: string;
        label?: string;
      }[];
      if (auto?.checked) {
        const again = (await session.evaluate(`${HELPERS}.autoToggle()`)) as {
          x: number;
          y: number;
          checked: boolean;
        } | null;
        if (again && !again.checked) await tap(session, again.x, again.y);
      }
      await closeMenus(session);
      const models = modelsFromMenuRows(rows || []);
      if (!models.length) return null;
      modelCache = { at: Date.now(), models };
      return models;
    } finally {
      session.close();
    }
  } catch {
    return null;
  }
}
