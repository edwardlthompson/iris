#!/usr/bin/env node
import { connectCdp, listWorkbenchTargets, pickAgentsTarget } from "../packages/adapter-cursor/dist/index.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await listWorkbenchTargets();
const t = pickAgentsTarget(targets);
if (!t) throw new Error("no target");
const s = await connectCdp(t.ws);

const tap = async (x, y) => {
  await s.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};

const esc = async () => {
  await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
};

try {
  const trig = await s.evaluate(`(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
    const text = [...document.querySelectorAll('.vscode-model-picker__trigger-text')].find(vis);
    const btn = text ? (text.closest('button,[role=button]') || text) : null;
    if (!btn || !vis(btn)) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, text: (btn.innerText||'').trim() };
  })()`);
  console.log(JSON.stringify({ trig }));
  await tap(trig.x, trig.y);
  await sleep(350);

  const auto = await s.evaluate(`(() => {
    const el = document.querySelector('[data-testid=auto-mode-toggle]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: r.x + r.width/2, y: r.y + r.height/2,
      checked: el.getAttribute('aria-checked'),
      text: (el.innerText||'').trim().slice(0,80)
    };
  })()`);
  console.log(JSON.stringify({ auto }));
  if (auto && auto.checked === "true") {
    await tap(auto.x, auto.y);
    await sleep(400);
  }

  // Re-open if closed
  const open = await s.evaluate(`!!document.querySelector('[data-testid=model-picker-menu]')`);
  if (!open) {
    await tap(trig.x, trig.y);
    await sleep(350);
  }

  const dump = await s.evaluate(`(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
    const menu = document.querySelector('[data-testid=model-picker-menu]');
    const text = menu ? (menu.innerText||'').trim().replace(/\\s+/g,' ').slice(0,800) : null;
    const rows = [...document.querySelectorAll('[data-testid=model-picker-menu] .ui-menu__row, [data-testid=model-picker-menu] [role=menuitem], [data-testid=model-picker-menu] li')].filter(vis).map(e => ({
      testid: e.dataset.testid || '',
      role: e.getAttribute('role')||'',
      text: (e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,100),
      params: !!e.querySelector('[data-testid=parameter-edit-btn]'),
      checked: e.getAttribute('aria-checked') || (!!e.querySelector('.codicon-check') ? 'check' : '')
    }));
    return { text, rows };
  })()`);
  console.log(JSON.stringify(dump, null, 2));
} finally {
  await esc();
  s.close();
}
