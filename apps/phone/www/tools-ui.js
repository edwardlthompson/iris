/** Composer tool sheets: Legs, History, Preset, Model, Usage. */
import { closeSheet, openSheet } from "./shell.js";

const PRESETS = [
  { id: "auto", label: "Auto", hint: "Pick the model from the task" },
  { id: "manual", label: "Manual", hint: "Pick any model yourself" },
  { id: "savings", label: "Savings", hint: "Auto → Grok · low" },
  { id: "balanced", label: "Balanced", hint: "Auto → Grok · medium" },
  { id: "performance", label: "Performance", hint: "Auto → Grok · high" },
  { id: "max", label: "Max", hint: "Auto → Grok · xhigh" },
];

/** Ranked Grok ladder fallback when host has not sent inventory yet. */
export const GROK_MODELS = [
  { id: "grok-4.7:xhigh", label: "Grok 4.7 · xhigh", score: 46.3, effort: "xhigh", rank: 4 },
  { id: "grok-4.7:high", label: "Grok 4.7 · high", score: 43.9, effort: "high", rank: 3 },
  { id: "grok-4.7:medium", label: "Grok 4.7 · medium", score: 41.6, effort: "medium", rank: 2 },
  { id: "grok-4.7:low", label: "Grok 4.7 · low", score: 33.1, effort: "low", rank: 1 },
];

const PRESET_MODEL = {
  savings: "grok-4.7:low",
  balanced: "grok-4.7:medium",
  performance: "grok-4.7:high",
  max: "grok-4.7:xhigh",
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Sheet pick binder — never {once:true} on empty taps (that ate Manual clicks). */
function bindSheet(attr, onPick, { onAct } = {}) {
  const sheet = document.getElementById("sheet");
  if (!sheet) return;
  if (sheet._irisPick) sheet.removeEventListener("click", sheet._irisPick);
  const h = (ev) => {
    const act = ev.target.closest("[data-act]");
    if (act && onAct) {
      onAct(act.getAttribute("data-act"), () => sheet.removeEventListener("click", h));
      return;
    }
    if (ev.target.closest("[data-close]")) return;
    const row = ev.target.closest(`[${attr}]`);
    if (!row || row.disabled || row.classList.contains("locked")) return;
    sheet.removeEventListener("click", h);
    closeSheet();
    onPick?.(row.getAttribute(attr));
  };
  sheet._irisPick = h;
  sheet.addEventListener("click", h);
}

export function presetLabel(id) {
  return PRESETS.find((p) => p.id === id)?.label || id || "Balanced";
}

export function isManual(preset) {
  return preset === "manual";
}

export function modelShortLabel(id) {
  const hit = GROK_MODELS.find((m) => m.id === id);
  if (hit) return `Grok · ${hit.effort}`;
  if (!id) return "model";
  const m = /:(low|medium|high|xhigh)$/i.exec(id);
  return m ? `Grok · ${m[1].toLowerCase()}` : id;
}

/** Model Performance mode would highlight (before/after Stage1). */
export function autoModelForPreset(preset, lastAuto) {
  if (lastAuto) return lastAuto;
  if (preset === "auto") return "";
  return PRESET_MODEL[preset] || PRESET_MODEL.balanced;
}

export function showLegsSheet(legs, { onAdd }) {
  const rows = (legs || [])
    .map((l) => {
      const on = l.connected || l.enabled;
      const sub = on
        ? l.model
          ? `Connected · ${l.model}`
          : "Connected"
        : l.setup || "Not configured";
      return `<button type="button" class="opt${on ? " cur" : ""}" data-leg="${esc(l.id)}"><span class="dot${on ? " ok" : ""}"></span><span class="lbl">${esc(l.label || l.id)}<span class="sub">${esc(sub)}</span></span>${on ? "" : '<span class="tag">Add</span>'}</button>`;
    })
    .join("");
  openSheet(`<h3>Legs</h3>${rows || "<p class='hint'>No legs</p>"}<button type="button" class="opt" data-close>Close</button>`);
  bindSheet("data-leg", onAdd);
}

export function showAddWizard(leg) {
  openSheet(
    `<h3>Add ${esc(leg?.label || leg?.id || "leg")}</h3><p class="hint">${esc(leg?.setup || "Configure this leg on the host, then Refresh.")}</p><button type="button" class="opt primary" data-close><span class="lbl">Got it</span></button>`,
  );
}

export function showHistorySheet(conversations, activeId, { onPick, loading = false, error = "" } = {}) {
  const rows = (conversations || [])
    .map((c) => {
      const cur = c.id === activeId ? " cur" : "";
      return `<button type="button" class="opt${cur}" data-id="${esc(c.id)}"><span class="lbl">${esc(c.title || c.id)}<span class="sub">${esc(c.project || "")}</span></span></button>`;
    })
    .join("");
  const body = loading
    ? "<p class='hint'>Loading chats…</p>"
    : error
      ? `<p class='hint'>${esc(error)}</p>`
      : rows || "<p class='hint'>No agent chats found.</p>";
  openSheet(`<h3>History</h3>${body}<button type="button" class="opt" data-close>Close</button>`);
  if (!loading) bindSheet("data-id", onPick);
}

export function showPresetSheet(current, { onPick }) {
  const rows = PRESETS.map((p) => {
    const cur = p.id === current ? " cur" : "";
    return `<button type="button" class="opt${cur}" data-preset="${p.id}"><span class="lbl">${p.label}<span class="sub">${p.hint}</span></span></button>`;
  }).join("");
  openSheet(
    `<h3>Performance mode</h3>${rows}<button type="button" class="opt" data-close>Close</button>`,
  );
  bindSheet("data-preset", onPick);
}

/**
 * @param models host inventory
 * @param picked highlighted id
 * @param {{ locked: boolean, onPick, onUnlockManual? }} opts
 */
export function showModelSheet(models, picked, { locked = false, onPick, onUnlockManual } = {}) {
  const list = (models || []).length ? models : GROK_MODELS;
  const ranked = [...list].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || (b.score ?? 0) - (a.score ?? 0));
  const rows = ranked
    .map((m) => {
      const id = m.id || m;
      const label = m.label || modelShortLabel(id);
      const on = id === picked;
      const parts = [];
      if (typeof m.score === "number") parts.push(`${m.score}% bench`);
      if (m.leg) parts.push(m.leg);
      if (m.effort) parts.push(m.effort);
      if (m.remainingPct === 0) parts.push("no quota");
      if (typeof m.rank === "number") parts.push(`rank ${5 - m.rank}`);
      const sub = locked
        ? on
          ? `${parts.join(" · ")} · active`
          : `${parts.join(" · ")} · locked`
        : parts.join(" · ");
      const cls = ["opt", on && "cur", locked && "locked"].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-model="${esc(id)}"${locked ? " disabled" : ""}><span class="lbl">${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span></button>`;
    })
    .join("");
  const hint = locked
    ? `<p class="hint">Performance manages the model. Switch to Manual to unlock every option.</p><button type="button" class="opt primary" data-act="manual"><span class="lbl">Switch to Manual</span></button>`
    : "";
  openSheet(`<h3>Model${locked ? " · Auto" : ""}</h3>${hint}${rows}<button type="button" class="opt" data-close>Close</button>`);
  bindSheet("data-model", onPick, {
    onAct: (act, done) => {
      if (act === "manual") {
        done?.();
        closeSheet();
        onUnlockManual?.();
      }
    },
  });
}

function leftColor(n) {
  if (n >= 40) return { stroke: "#7CFF6B", cls: "uOk" };
  if (n >= 15) return { stroke: "#FFE14A", cls: "uHot" };
  return { stroke: "#FF5A1F", cls: "uCrit" };
}

function oneRing(n) {
  const c = 2 * Math.PI * 12;
  const col = leftColor(n ?? 0).stroke;
  const off = n == null ? c : c * (1 - n / 100);
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="#830094" stroke-width="7"/>${
    n != null && n > 0
      ? `<circle cx="16" cy="16" r="12" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="butt" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 16 16)"/>`
      : ""
  }</svg>`;
}

function quotaRingSvg(n5, n7, h5Disabled) {
  if (n5 == null || h5Disabled) return oneRing(n7);
  const c5 = 2 * Math.PI * 11;
  const c7 = 2 * Math.PI * 5.2;
  const o5 = c5 * (1 - n5 / 100);
  const o7 = n7 == null ? 0 : c7 * (1 - n7 / 100);
  const col5 = leftColor(n5).stroke;
  const col7 = leftColor(n7 ?? 0).stroke;
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="#830094" stroke-width="6"/>${
    n5 > 0
      ? `<circle cx="16" cy="16" r="11" fill="none" stroke="${col5}" stroke-width="6" stroke-linecap="butt" stroke-dasharray="${c5.toFixed(1)}" stroke-dashoffset="${o5.toFixed(1)}" transform="rotate(-90 16 16)"/>`
      : ""
  }<circle cx="16" cy="16" r="5.2" fill="none" stroke="#830094" stroke-width="3.2"/>${
    n7 != null && n7 > 0
      ? `<circle cx="16" cy="16" r="5.2" fill="none" stroke="${col7}" stroke-width="3.2" stroke-linecap="butt" stroke-dasharray="${c7.toFixed(1)}" stroke-dashoffset="${o7.toFixed(1)}" transform="rotate(-90 16 16)"/>`
      : ""
  }</svg>`;
}

export function renderUsageBar(el, usage, { onOpen } = {}) {
  if (!el) return;
  const products = usage?.products;
  if (!products?.length) {
    el.hidden = true;
    el.replaceChildren();
    return;
  }
  el.hidden = false;
  const groups = [];
  for (const p of products) {
    const key = p.program || p.id;
    let g = groups.find((row) => row.key === key);
    if (!g) {
      g = { key, label: p.label || key, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  el.innerHTML = groups
    .map((g) => {
      const p = g.items.slice().sort((a, b) => (a.d7Left ?? 101) - (b.d7Left ?? 101))[0];
      const has5 = p.h5Left != null && Number.isFinite(Number(p.h5Left));
      const h5Dis = Boolean(p.h5Disabled);
      const n5 = has5 ? Math.max(0, Math.min(100, Math.round(p.h5Left))) : null;
      const n7 = p.d7Left == null ? null : Math.max(0, Math.min(100, Math.round(p.d7Left)));
      const c5 = has5 && !h5Dis ? leftColor(n5) : null;
      const c7 = leftColor(n7 ?? 0);
      const title = has5
        ? h5Dis
          ? `${p.name || p.label}: 5h paused, period ${n7}% left`
          : `${p.name || p.label}: 5h ${n5}% · period ${n7}% left`
        : n7 == null
          ? `${p.name || p.label}: no meter`
          : `${p.name || p.label}: ${n7}% left`;
      const nums = n7 == null
        ? `<span class="uSep">—</span>`
        : has5
        ? h5Dis
          ? `<span class="uSep">—</span><span class="uSep">/</span><span class="${c7.cls}">${n7}</span>`
          : `<span class="${c5.cls}">${n5}</span><span class="uSep">/</span><span class="${c7.cls}">${n7}</span>`
        : `<span class="${c7.cls}">${n7}%</span>`;
      return `<button type="button" class="uChip" data-usage-chip="${esc(g.key)}" title="${esc(title)}" aria-label="${esc(title)}">${quotaRingSvg(n5, n7, h5Dis)}<span class="uMeta"><span class="uName">${esc(g.label)}</span><span class="uNums">${nums}</span></span></button>`;
    })
    .join("");
  el.onclick = (ev) => {
    const id = ev.target.closest("[data-usage-chip]")?.getAttribute("data-usage-chip");
    onOpen?.(usage, id);
  };
}

export function showUsageSheet(usage, chipId) {
  const all = usage?.products || [];
  const products = chipId
    ? all.filter((p) => p.id === chipId || p.program === chipId)
    : all;
  if (!products.length) {
    openSheet(`<h3>Usage</h3><p class="hint">No usage data yet. Pair with the host.</p><button type="button" class="opt" data-close>Close</button>`);
    return;
  }
  const cards = products
    .map((p) => {
      const has5 = p.h5Left != null && Number.isFinite(Number(p.h5Left));
      const h5Dis = Boolean(p.h5Disabled);
      const n5 = has5 ? Math.max(0, Math.min(100, Math.round(p.h5Left))) : null;
      const n7 = p.d7Left == null ? null : Math.max(0, Math.min(100, Math.round(p.d7Left)));
      const c5 = has5 && !h5Dis ? leftColor(n5) : null;
      const c7 = leftColor(n7 ?? 0);
      const row7 = n7 == null
        ? `<div class="uBarRow"><span class="uBarWin">plan</span><div class="uBarTrack"></div><span class="uBarPct">No meter</span></div>`
        : `<div class="uBarRow"><span class="uBarWin">7d</span><div class="uBarTrack"><div class="uBarFill" style="width:${n7}%;background:${c7.stroke}"></div></div><span class="uBarPct ${c7.cls}">${n7}% left</span><span class="uBarRst">↻ ${esc(p.reset7d || "period")}</span></div>`;
      const row5 = has5
        ? h5Dis
          ? `<div class="uBarRow" style="opacity:0.55"><span class="uBarWin">5h</span><div class="uBarTrack"><div class="uBarFill" style="width:0%;background:#6e6e73"></div></div><span class="uBarPct">Paused</span><span class="uBarRst">Weekly</span></div>`
          : `<div class="uBarRow"><span class="uBarWin">5h</span><div class="uBarTrack"><div class="uBarFill" style="width:${n5}%;background:${c5.stroke}"></div></div><span class="uBarPct ${c5.cls}">${n5}% left</span><span class="uBarRst">↻ ${esc(p.reset5h || "5h")}</span></div>`
        : "";
      return `<div class="uSheetCard"><div class="uSheetHead">${quotaRingSvg(n5, n7, h5Dis)}<div><div class="uSheetTitle">${esc(p.name || p.label)}</div><div class="uSheetSub">${esc(p.models || "Cursor")}</div></div></div>${row7}${row5}</div>`;
    })
    .join("");
  const title = products[0]?.label || "Usage";
  openSheet(
    `<h3>${esc(title)}</h3><p class="hint">5h and 7d remaining for this program</p>${cards}<button type="button" class="opt" data-close>Close</button>`,
  );
}
