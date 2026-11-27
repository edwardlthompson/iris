/** Shell chrome: mode tabs, sheets, composer (no Screen). UI matches cursor-remote-lite. */
export const UI_BUILD = 56;

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const store = {
  get: (k) => localStorage.getItem(`iris.${k}`),
  set: (k, v) =>
    v == null ? localStorage.removeItem(`iris.${k}`) : localStorage.setItem(`iris.${k}`, v),
};

let mode = (() => {
  const m = store.get("mode");
  return m === "pane" || m === "files" ? m : "chat";
})();
if (store.get("composer") === "collapsed") document.body.classList.add("composer-collapsed");

function isLandscape() {
  return window.matchMedia("(orientation: landscape)").matches;
}

export function applyViews() {
  const chat = $("chatView");
  const pane = $("paneView");
  const dual = mode === "pane";
  document.body.classList.toggle("tablet-dash", true);
  document.body.classList.toggle("dual-pane", dual);
  document.body.classList.toggle("files-only", mode === "files");
  chat?.classList.toggle("active", mode === "chat" || dual);
  pane?.classList.toggle("active", mode === "files" || dual);
  for (const [id, on] of [
    ["tabChat", mode === "chat"],
    ["tabPane", mode === "pane"],
    ["tabFiles", mode === "files"],
  ]) {
    const el = $(id);
    if (!el) continue;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  }
}

function bindSplit() {
  const split = $("paneSplit");
  const main = document.querySelector("main");
  if (!split || !main || split.dataset.bound) return;
  split.dataset.bound = "1";
  split.addEventListener("pointerdown", (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    split.setPointerCapture(ev.pointerId);
    split.classList.add("dragging");
    const move = (e) => {
      const box = main.getBoundingClientRect();
      const land = isLandscape();
      const ratio = land ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height;
      const pct = Math.round(Math.min(72, Math.max(28, ratio * 100)));
      document.documentElement.style.setProperty("--dual-split", `${pct}%`);
      split.setAttribute("aria-valuenow", String(pct));
    };
    const up = (e) => {
      split.classList.remove("dragging");
      split.removeEventListener("pointermove", move);
      split.removeEventListener("pointerup", up);
      try { split.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    split.addEventListener("pointermove", move);
    split.addEventListener("pointerup", up);
  });
}

function bindToBottom() {
  const list = $("list");
  const btn = $("toBottom");
  if (!list || !btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  const roots = [list, document.scrollingElement, document.documentElement].filter(Boolean);
  const away = (el) => el.scrollHeight - el.scrollTop - el.clientHeight > 80;
  const sync = () => {
    btn.classList.toggle("show", roots.some(away));
  };
  for (const el of roots) el.addEventListener("scroll", sync, { passive: true });
  btn.addEventListener("click", () => {
    for (const el of roots) el.scrollTop = el.scrollHeight;
    sync();
  });
  sync();
}

function bindComposerGrow() {
  const ta = $("text");
  if (!ta || ta.dataset.grow) return;
  ta.dataset.grow = "1";
  const fit = () => {
    const room = Math.round(window.innerHeight * 0.42);
    if (!ta.value) {
      ta.style.height = "34px";
      return;
    }
    ta.style.height = "0px";
    const next = Math.min(Math.max(ta.scrollHeight, 34), room);
    ta.style.height = `${next}px`;
  };
  ta.addEventListener("input", fit);
  fit();
}

export function setMode(next) {
  mode = next === "pane" || next === "files" ? next : "chat";
  store.set("mode", mode);
  saveRepoState({ mode });
  applyViews();
}

export function setComposerCollapsed(collapsed) {
  document.body.classList.toggle("composer-collapsed", Boolean(collapsed));
  $("composerToggle")?.setAttribute("aria-expanded", collapsed ? "false" : "true");
  store.set("composer", collapsed ? "collapsed" : "open");
  saveRepoState({ composer: collapsed ? "collapsed" : "open" });
}

function saveRepoState(patch) {
  const key = store.get("repoKey") || "default";
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem("iris.workspace") || "{}") || {};
  } catch {
    all = {};
  }
  all[key] = { ...(all[key] || {}), ...patch };
  localStorage.setItem("iris.workspace", JSON.stringify(all));
}

export function openSheet(html) {
  const sheet = $("sheet");
  const shade = $("shade");
  if (!sheet || !shade) return;
  sheet.classList.remove("top");
  sheet.innerHTML = html;
  sheet.classList.add("open");
  shade.classList.add("open");
}

export function closeSheet() {
  const sheet = $("sheet");
  sheet?.classList.remove("open", "top");
  $("shade")?.classList.remove("open");
}

export function setGateOpen(open) {
  $("gate")?.classList.toggle("open", open);
}

export function setConnOk(ok) {
  const bell = $("statusBell");
  if (!bell) return;
  bell.classList.toggle("ok", ok);
  bell.classList.toggle("bad", !ok);
}

export function setStatusMsg(text, err = false) {
  const st = $("gateStatus");
  const live = $("msg");
  if (st && $("gate")?.classList.contains("open")) {
    st.textContent = text;
    st.classList.toggle("err", err);
    st.hidden = !text;
  }
  if (live) live.textContent = text;
}

function showStatusSheet(info) {
  const connected = !!info?.connected;
  const legs = info?.legs?.length ? info.legs.map((n) => esc(n)).join(", ") : "none";
  openSheet(
    `<h3>Status</h3><div class="statusConn ${connected ? "ok" : ""}"><i></i><span>${connected ? "Connected" : "Disconnected"}</span></div><p class="hint">${esc(info?.host || "No host")}</p><p class="hint">Legs: ${legs}</p><p class="hint">UI ${UI_BUILD}</p><button type="button" class="opt" data-close>Close</button>`,
  );
}

function showMainMenu(onUnpair, info, onLegs) {
  const connected = !!info?.connected;
  const legRows = (info?.legs || [])
    .map((n) => `<button type="button" class="opt" data-act="legs"><span class="lbl">${esc(n)}</span></button>`)
    .join("");
  openSheet(
    `<h3>Iris</h3><div class="statusConn ${connected ? "ok" : ""}"><i></i><span>${connected ? "Connected" : "Disconnected"}</span></div><p class="hint">${esc(info?.host || "")}</p>${legRows}<button type="button" class="opt" data-act="legs"><span class="lbl">Legs</span></button><button type="button" class="opt" data-act="reload"><span class="lbl">Reload UI</span></button><button type="button" class="opt danger" data-act="unpair"><span class="lbl">Disconnect</span></button><button type="button" class="opt" data-close>Close</button>`,
  );
  const sheet = $("sheet");
  if (!sheet) return;
  sheet.onclick = (ev) => {
    const t = ev.target.closest("[data-act],[data-close]");
    if (!t) return;
    if (t.hasAttribute("data-close")) closeSheet();
    else if (t.dataset.act === "reload") location.reload();
    else if (t.dataset.act === "legs") {
      closeSheet();
      onLegs?.();
    } else if (t.dataset.act === "unpair") {
      closeSheet();
      onUnpair?.();
    }
  };
}

export function bindShell({ onUnpair, getConn, getOverflow, onLegs } = {}) {
  const build = $("uiBuild");
  if (build) build.textContent = `UI ${UI_BUILD}`;
  bindSplit();
  bindComposerGrow();
  bindToBottom();

  $("tabChat")?.addEventListener("click", () => setMode("chat"));
  $("tabPane")?.addEventListener("click", () => setMode("pane"));
  $("tabFiles")?.addEventListener("click", () => setMode("files"));
  $("shade")?.addEventListener("click", closeSheet);
  $("sheet")?.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-close]")) closeSheet();
  });
  const overflow = () =>
    getOverflow?.() || { connected: getConn?.() ?? false, host: "", legs: [] };
  $("statusBell")?.addEventListener("click", () => {
    $("statusBadge")?.classList.remove("on");
    showStatusSheet(overflow());
  });
  $("menuBtn")?.addEventListener("click", () => showMainMenu(onUnpair, overflow(), onLegs));
  $("composerToggle")?.addEventListener("click", () => {
    setComposerCollapsed(!document.body.classList.contains("composer-collapsed"));
  });

  window.addEventListener("orientationchange", applyViews);
  window.matchMedia("(orientation: landscape)").addEventListener("change", applyViews);
  applyViews();

  const vv = window.visualViewport;
  if (vv) {
    const fit = () => {
      document.body.style.height = `${vv.height}px`;
    };
    vv.addEventListener("resize", fit);
    fit();
  }
}

globalThis.__IRIS_SHELL__ = { setMode, applyViews, UI_BUILD };
