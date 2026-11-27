#!/usr/bin/env node
/** Smoke: CDP select Grok 4.7 · low, read trigger, optional submit. */
import {
  connectCdp,
  createCdpCursorBridge,
  listWorkbenchTargets,
  pickAgentsTarget,
  selectCursorModelEffort,
} from "../packages/adapter-cursor/dist/index.js";

const READ_MODEL = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
  const el = [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis);
  return el ? el.innerText.trim().replace(/\\s+/g, ' ') : null;
})()`;

const LIST_ROWS = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const trig = [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis);
  if (trig) { /* opened by caller */ }
  return [...document.querySelectorAll('.ui-menu__row')].filter(e => e.querySelector('.ui-model-picker__item-content-name')).filter(e => vis(e)).map(e => ({
    id: e.dataset.testid,
    label: e.querySelector('.ui-model-picker__item-content-name').innerText.trim(),
    params: !!e.querySelector('[data-testid=parameter-edit-btn]'),
    checked: !!e.querySelector('.codicon-check, .ui-model-picker__item-right-section [class*=check]')
  }));
})()`;

const USAGE_CHIP = `(() => {
  const btn = [...document.querySelectorAll('button,[role=button]')].find(e => {
    const t = (e.getAttribute('aria-label') || e.innerText || '').trim();
    return /^Usage\\s+\\d{1,3}%/i.test(t);
  });
  if (!btn) return null;
  const m = /Usage\\s+(\\d{1,3})%/i.exec(btn.getAttribute('aria-label') || btn.innerText || '');
  return m ? { usedPct: Number(m[1]), label: (btn.getAttribute('aria-label') || '').trim() } : null;
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await listWorkbenchTargets();
const target = pickAgentsTarget(targets);
console.log(JSON.stringify({ target: target?.title ?? null }));
if (!target) process.exit(1);

const session = await connectCdp(target.ws);
try {
  const before = await session.evaluate(READ_MODEL);
  const usage = await session.evaluate(USAGE_CHIP);
  console.log(JSON.stringify({ model_before: before, usage_chip: usage }));

  // Open menu and dump rows for diagnostics
  const trig = await session.evaluate(`(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8; };
    const el = [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.innerText.trim() };
  })()`);
  if (trig) {
    await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x: trig.x, y: trig.y, button: "left", clickCount: 1 });
    await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: trig.x, y: trig.y, button: "left", clickCount: 1 });
    await sleep(250);
    const rows = await session.evaluate(LIST_ROWS);
    console.log(JSON.stringify({ menu_rows: rows }));
    await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(150);
  }

  const sel = await selectCursorModelEffort(session, { pickerLabel: "Grok 4.7", effort: "low" });
  console.log(JSON.stringify({ select: sel }));
  await sleep(500);
  const after = await session.evaluate(READ_MODEL);
  console.log(JSON.stringify({ model_after: after }));
} finally {
  session.close();
}

const bridge = createCdpCursorBridge({ submit: true });
const out = await bridge.send({
  prompt: "Iris smoke: reply with only the word pong-low. Do not use tools.",
  model: "grok-4.7:low",
  effort: "low",
  pickerLabel: "Grok 4.7",
});
console.log(JSON.stringify({ send: out }));
