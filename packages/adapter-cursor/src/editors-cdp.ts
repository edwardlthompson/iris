import { connectCdp, listWorkbenchTargets, pickAgentsTarget, type CdpSession } from "./cdp.js";

export type EditorTab = {
  name: string;
  label: string;
  active: boolean;
  dirty: boolean;
};

const LIST = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const nameOf = t => {
    const raw = (t.getAttribute('aria-label')
      || t.querySelector('.ui-tab-system-tab__content, .tab-label, .label-name')?.innerText
      || t.innerText || '').trim().replace(/\\s+/g, ' ');
    return raw.replace(/\\s*[●\\*].*$/, '').replace(/\\s+U$/i, '').replace(/\\s*preview$/i, '').trim() || raw;
  };
  const keep = name => {
    if (!name) return false;
    if (/^(Tasks|Library|Pull Requests|Context|Canvases)$/i.test(name)) return false;
    if (/^Changes$/i.test(name)) return true;
    if (/^(Simple Browser|Preview)/i.test(name)) return true;
    return /\\.\\w{1,16}$/.test(name) || /[\\\\/]/.test(name);
  };
  const modern = [...document.querySelectorAll('.ui-tab-system-tab')];
  const classic = [...document.querySelectorAll('.tabs-container .tab, .editor-group-container .tab')];
  return [...modern, ...classic].filter(e => vis(e) && !/Chat Editors/i.test(e.getAttribute('aria-label') || '')).map(t => {
    const name = nameOf(t);
    if (!keep(name)) return null;
    return {
      name,
      label: t.getAttribute('aria-label') || name,
      active: t.getAttribute('aria-selected') === 'true' || t.classList.contains('active') || t.classList.contains('selected'),
      dirty: !!(t.querySelector('.dirty, .codicon-circle-filled') || /[●\\*]|\\sU$/i.test(t.getAttribute('aria-label') || t.innerText || '')),
    };
  }).filter(Boolean);
})()`;

const FOCUS = (name: string) => `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const nameOf = t => {
    const raw = (t.getAttribute('aria-label')
      || t.querySelector('.ui-tab-system-tab__content, .tab-label')?.innerText
      || t.innerText || '').trim().replace(/\\s+/g, ' ');
    return raw.replace(/\\s*[●\\*].*$/, '').replace(/\\s+U$/i, '').trim();
  };
  const want = ${JSON.stringify(name)};
  const tabs = [...document.querySelectorAll('.ui-tab-system-tab, .tabs-container .tab')].filter(vis);
  const t = tabs.find(e => nameOf(e) === want || (e.getAttribute('aria-label') || '').startsWith(want));
  if (!t) return null;
  const r = t.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`;

async function withAgents<T>(fn: (s: CdpSession) => Promise<T>): Promise<T | null> {
  try {
    const targets = await listWorkbenchTargets();
    const target = pickAgentsTarget(targets);
    if (!target) return null;
    const session = await connectCdp(target.ws);
    try {
      return await fn(session);
    } finally {
      session.close();
    }
  } catch {
    return null;
  }
}

export async function listEditorTabs(): Promise<EditorTab[]> {
  const tabs = await withAgents((s) => s.evaluate(LIST) as Promise<EditorTab[] | null>);
  return tabs ?? [];
}

export async function focusEditorTab(name: string): Promise<boolean> {
  const ok = await withAgents(async (s) => {
    const pos = (await s.evaluate(FOCUS(name))) as { x: number; y: number } | null;
    if (!pos) return false;
    await s.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: pos.x,
      y: pos.y,
      button: "left",
      clickCount: 1,
    });
    await s.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: pos.x,
      y: pos.y,
      button: "left",
      clickCount: 1,
    });
    return true;
  });
  return ok === true;
}
