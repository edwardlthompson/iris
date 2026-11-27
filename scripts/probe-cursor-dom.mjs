#!/usr/bin/env node
import { connectCdp, listWorkbenchTargets, pickAgentsTarget } from "../packages/adapter-cursor/dist/index.js";

const EXPR = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; };
  const ariaModel = [...document.querySelectorAll('[aria-label*=model i], [aria-label*=Model], [aria-label*=Auto]')].filter(vis).map(e => ({
    tag: e.tagName, aria: e.getAttribute('aria-label'), text: (e.innerText||'').trim().slice(0,80),
    cls: String(e.className).slice(0,120), testid: e.getAttribute('data-testid')||'',
    r: (() => { const b=e.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; })()
  }));
  const textAuto = [...document.querySelectorAll('button, [role=button], div, span')].filter(vis).filter(e => {
    const t = (e.innerText||'').trim();
    return /^(Auto|Grok|Composer|Claude|Opus|Sonnet)/i.test(t) && t.length < 40;
  }).slice(0, 30).map(e => ({
    tag: e.tagName, text: (e.innerText||'').trim().slice(0,40), cls: String(e.className).slice(0,100),
    aria: e.getAttribute('aria-label')||'', parent: e.parentElement ? String(e.parentElement.className).slice(0,80) : ''
  }));
  const usage = [...document.querySelectorAll('button,[role=button]')].filter(e => /^Usage\\s+\\d/i.test((e.getAttribute('aria-label')||e.innerText||'').trim())).map(e => ({
    aria: e.getAttribute('aria-label'), text: (e.innerText||'').trim().slice(0,40)
  }));
  const editors = [
    '.aislash-editor-input[contenteditable=true]',
    '.ui-prompt-input-editor__input[contenteditable=true]',
    '.composer-bar [contenteditable=true]',
    '.auxiliarybar [contenteditable=true]',
    '[contenteditable=true]'
  ].map(sel => ({ sel, n: [...document.querySelectorAll(sel)].filter(vis).length }));
  // Bottom composer chrome: last 200px of viewport
  const h = window.innerHeight;
  const bottom = [...document.querySelectorAll('button, [role=button], div')].filter(e => {
    if (!vis(e)) return false;
    const r = e.getBoundingClientRect();
    return r.bottom > h - 220 && r.top < h && r.width > 20 && r.width < 400 && r.height < 60;
  }).map(e => ({
    text: (e.innerText||'').trim().replace(/\\s+/g,' ').slice(0,50),
    aria: (e.getAttribute('aria-label')||'').slice(0,60),
    cls: String(e.className).slice(0,90),
    y: Math.round(e.getBoundingClientRect().y)
  })).filter(x => x.text || x.aria).slice(0, 40);
  return { ariaModel, textAuto, usage, editors, bottom };
})()`;

const targets = await listWorkbenchTargets();
const t = pickAgentsTarget(targets) || targets[0];
if (!t) {
  console.log(JSON.stringify({ err: "no targets" }));
  process.exit(1);
}
const s = await connectCdp(t.ws);
try {
  console.log(JSON.stringify(await s.evaluate(EXPR), null, 2));
} finally {
  s.close();
}
