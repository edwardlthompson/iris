import {
  bindShell,
  closeSheet,
  setConnOk,
  setGateOpen,
  setStatusMsg,
} from "./shell.js";
import { renderActionBar, renderQuestions, renderQueue } from "./bars-ui.js";
import { renderCostChip } from "./cost-ui.js";
import { renderChat } from "./chat-ui.js";
import { renderChangedFiles, renderEditorTabs, renderFileHits, showDiff, showWorkspaceFile, hideWorkspaceFile } from "./files-ui.js";
import {
  autoModelForPreset,
  isManual,
  modelShortLabel,
  presetLabel,
  renderUsageBar,
  showAddWizard,
  showHistorySheet,
  showLegsSheet,
  showModelSheet,
  showPresetSheet,
  showUsageSheet,
} from "./tools-ui.js";

const form = document.getElementById("pair-form");
const codeEl = document.getElementById("gateInput");
const hostEl = document.getElementById("host");
const emptyEl = document.getElementById("empty");
const itemsEl = document.getElementById("items");
const usageBar = document.getElementById("usageBar");
const promptEl = document.getElementById("text");
const queueBar = document.getElementById("queueBar");
const actionBar = document.getElementById("actionBar");
const qnBar = document.getElementById("qnBar");
let sending = false;
let holdRun = false;
let sawBusy = false;
let holdSince = 0;
let queued = [];
let qSeq = 0;

function paintQueue() {
  renderQueue(queueBar, { busy: sending || holdRun, queued }, (act) => {
    if (act.action === "stop") {
      sending = false;
      holdRun = false;
      sawBusy = false;
      queued = [];
      ws?.send(JSON.stringify({ type: "stop" }));
      paintQueue();
      setStatusMsg("Stop requested");
      return;
    }
    if (act.action === "remove") queued = queued.filter((q) => q.id !== act.id);
    paintQueue();
  });
}

function flushQueue() {
  if (sending || !queued.length || !ws) return;
  const next = queued.shift();
  paintQueue();
  sendPrompt(next.t);
}
const pickPreset = document.getElementById("pickPreset");
const pickModel = document.getElementById("pickModel");

let ws = null;
let chatPoll = null;
let legs = [];
let models = [];
let usage = null;
let pickedModel = localStorage.getItem("iris.model") || "grok-4.7:medium";
let preset = (() => {
  const p = localStorage.getItem("iris.preset");
  return ["auto", "manual", "savings", "balanced", "performance", "max"].includes(p || "")
    ? p
    : "auto";
})();
let lastAutoModel = null;
let activeChatId = null;
let editorTabs = [];
let editorPoll = null;
let pendingHistory = false;
let activeLeg = localStorage.getItem("iris.leg") || "cursor";
let activeRung = "lan";

const saved = localStorage.getItem("iris.ws");
if (saved && hostEl) hostEl.value = saved;
else if (hostEl) hostEl.value = "ws://127.0.0.1:7842";
const savedCode = localStorage.getItem("iris.pairCode");
if (savedCode && codeEl) codeEl.value = savedCode;

function applyShared(prefs) {
  if (!prefs) return;
  const modes = ["auto", "manual", "savings", "balanced", "performance", "max"];
  if (modes.includes(prefs.preset)) {
    preset = prefs.preset;
    localStorage.setItem("iris.preset", preset);
  }
  if (prefs.model) {
    pickedModel = prefs.model;
    localStorage.setItem("iris.model", pickedModel);
  }
  if (prefs.leg) {
    activeLeg = prefs.leg;
    localStorage.setItem("iris.leg", activeLeg);
  }
  syncChips();
}

function pushPrefs() {
  ws?.send(JSON.stringify({ type: "prefs", preset, model: pickedModel, leg: activeLeg }));
}

function activeModelId() {
  return isManual(preset) ? pickedModel : autoModelForPreset(preset, lastAutoModel);
}

function syncChips() {
  renderCostChip(document.getElementById("costChip"), preset, activeModelId());
  if (pickPreset) {
    pickPreset.textContent = presetLabel(preset);
    pickPreset.title = "Performance mode";
  }
  if (pickModel) {
    pickModel.hidden = false;
    pickModel.style.display = "";
    const mid = activeModelId();
    if (isManual(preset)) {
      pickModel.textContent = modelShortLabel(pickedModel);
      pickModel.title = "Manual model";
      pickModel.classList.remove("auto");
    } else {
      // Show the mapped model so Savings→low is visible immediately
      pickModel.textContent = modelShortLabel(mid);
      pickModel.title = `Auto · ${presetLabel(preset)} · ${modelShortLabel(mid)}`;
      pickModel.classList.add("auto");
    }
  }
}

function refreshUsage() {
  renderUsageBar(usageBar, usage, {
    onOpen: (data, chipId) => {
      showUsageSheet(data, chipId);
      ws?.send(JSON.stringify({ type: "status" }));
    },
  });
}

function stopChatPoll() {
  if (chatPoll) clearInterval(chatPoll);
  chatPoll = null;
}

function startChatPoll() {
  stopChatPoll();
  chatPoll = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "chat", id: activeChatId || undefined }));
      ws.send(JSON.stringify({ type: "editors", leg: activeLeg }));
      ws.send(JSON.stringify({ type: "changes" }));
    }
  }, 2500);
}

function focusEditor(name) {
  if (!ws || !name) return;
  ws.send(JSON.stringify({ type: "editor_focus", name, leg: activeLeg }));
  ws.send(JSON.stringify({ type: "file", name }));
  setStatusMsg(`Opening ${name}…`);
}

function applySnap(payload) {
  legs = payload.legs || [];
  models = payload.models || models;
  if (payload.usage) usage = payload.usage;
  // Do not let host credit-best overwrite Performance→model mapping.
  if (payload.pickedModel && isManual(preset)) pickedModel = payload.pickedModel;
  syncChips();
  refreshUsage();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      socket.close();
      reject(new Error("timeout"));
    }, 8000);
    socket.addEventListener("open", () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      clearTimeout(t);
      reject(new Error("socket error"));
    });
  });
}

const pendingPhotos = [];

function paintPhotos() {
  const strip = document.getElementById("photoStrip");
  if (!strip) return;
  strip.innerHTML = pendingPhotos
    .map(
      (p, i) =>
        `<figure><img src="${p.url}" alt=""><button type="button" data-drop-photo="${i}" aria-label="Remove photo">×</button></figure>`,
    )
    .join("");
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    img.src = url;
  });
}

function sendPrompt(text) {
  sending = true;
  holdRun = true;
  sawBusy = false;
  holdSince = Date.now();
  paintQueue();
  const payload = { type: "prompt", text, preset, leg: activeLeg };
  if (pendingPhotos.length) {
    payload.images = pendingPhotos.map(({ data, name, mime }) => ({ data, name, type: mime }));
    pendingPhotos.length = 0;
    paintPhotos();
  }
  if (isManual(preset)) payload.model = pickedModel;
  ws.send(JSON.stringify(payload));
  setStatusMsg(isManual(preset) ? `Sending · ${modelShortLabel(pickedModel)}…` : "Sending · auto…");
}

function unpair() {
  localStorage.removeItem("iris.deviceToken");
  stopChatPoll();
  const old = ws;
  ws = null;
  old?.close();
  sending = false;
  holdRun = false;
  queued = [];
  paintQueue();
  renderActionBar(actionBar, []);
  renderQuestions(qnBar, null);
  setGateOpen(true);
  setConnOk(false);
  setStatusMsg("Disconnected");
}

function openModelSheet() {
  const locked = !isManual(preset);
  showModelSheet(models, activeModelId(), {
    locked,
    onPick: (id) => {
      if (locked) return;
      pickedModel = id;
      localStorage.setItem("iris.model", id);
      syncChips();
      pushPrefs();
    },
    onUnlockManual: () => {
      preset = "manual";
      localStorage.setItem("iris.preset", "manual");
      syncChips();
      pushPrefs();
      openModelSheet();
    },
  });
}

function bindSocket(socket) {
  ws = socket;
  setConnOk(true);
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "paired") {
      applySnap(msg);
      if (msg.token) localStorage.setItem("iris.deviceToken", msg.token);
      setGateOpen(false);
      applyShared(msg.prefs);
      setStatusMsg(`Paired · ${activeRung}`);
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      startChatPoll();
      ws.send(JSON.stringify({ type: "chat" }));
    } else if (msg.type === "setup_result") {
      setStatusMsg(msg.detail || "Setting up leg");
    } else if (msg.type === "prefs") {
      applyShared(msg);
    } else if (msg.type === "status") {
      applySnap(msg);
    } else if (msg.type === "file") {
      showWorkspaceFile(msg);
      setStatusMsg(msg.error ? msg.error : msg.path || msg.name);
    } else if (msg.type === "changes") {
      renderChangedFiles(msg.files || [], {
        onDiff: (name) => ws?.send(JSON.stringify({ type: "diff", name })),
      });
    } else if (msg.type === "diff") {
      showDiff(msg);
    } else if (msg.type === "editors") {
      editorTabs = msg.tabs || [];
      renderEditorTabs(editorTabs, { onFocus: focusEditor });
      const q = document.getElementById("panePickInput")?.value || "";
      renderFileHits(editorTabs, q, { onFocus: focusEditor });
    } else if (msg.type === "history") {
      if (!pendingHistory) return;
      pendingHistory = false;
      showHistorySheet(msg.conversations || [], activeChatId, {
        error: msg.error || "",
        onPick: (id) => {
          activeChatId = id;
          ws.send(JSON.stringify({ type: "chat", id }));
          setStatusMsg("Loading chat…");
        },
      });
    } else if (msg.type === "chat") {
      if (msg.id) activeChatId = msg.id;
      renderChat(msg.items || [], itemsEl, emptyEl);
      if (msg.busy) {
        holdRun = true;
        sawBusy = true;
        paintQueue();
      } else if (holdRun && sawBusy) {
        holdRun = false;
        sawBusy = false;
        sending = false;
        holdSince = 0;
        paintQueue();
        flushQueue();
        notifyShade("Iris", "Agent finished");
      } else if (holdRun && holdSince && Date.now() - holdSince > 20000) {
        holdRun = false;
        sending = false;
        holdSince = 0;
        paintQueue();
        flushQueue();
      }
      if (Array.isArray(msg.global)) renderActionBar(actionBar, msg.global, (label) => {
        ws.send(JSON.stringify({ type: "approval", decision: label }));
        renderActionBar(actionBar, []);
      });
      if (msg.questions) renderQuestions(qnBar, msg.questions, (part) => {
        ws.send(JSON.stringify({ type: "question", ...part }));
      });
    } else if (msg.type === "prompt_result") {
      if (msg.pickedModel || msg.model) {
        const mid = msg.pickedModel || msg.model;
        if (isManual(preset)) {
          pickedModel = mid;
          localStorage.setItem("iris.model", pickedModel);
        } else {
          lastAutoModel = mid;
        }
        syncChips();
      }
      if (msg.usage) {
        usage = msg.usage;
        refreshUsage();
      }
      const autoHint =
        !isManual(preset) && (msg.pickedModel || msg.model)
          ? ` · ${modelShortLabel(msg.pickedModel || msg.model)}`
          : "";
      const dest = msg.leg === "antigravity" ? "Antigravity" : msg.leg === "claude" ? "Claude Code" : "Cursor Agent";
      const doneText =
        msg.stopReason === "submitted"
          ? `Sent to ${dest}${autoHint}`
          : msg.stopReason || "Done";
      setStatusMsg(doneText);
      if (msg.stopReason === "submitted") {
        holdRun = true;
        if (!holdSince) holdSince = Date.now();
        paintQueue();
      } else {
        holdRun = false;
        sawBusy = false;
        holdSince = 0;
        notifyShade("Iris", doneText);
        sending = false;
        paintQueue();
        flushQueue();
      }
      ws.send(JSON.stringify({ type: "chat", id: activeChatId || undefined }));
    } else if (msg.type === "approval") {
      renderActionBar(actionBar, msg.labels || ["Allow", "Deny"], (label) => {
        ws.send(JSON.stringify({ type: "approval", id: msg.id, decision: label }));
        renderActionBar(actionBar, []);
      });
    } else if (msg.type === "question") {
      renderQuestions(qnBar, msg.questions, (part) => {
        ws.send(JSON.stringify({ type: "question", id: msg.id, ...part }));
        if (part.part === "submit" || part.part === "skip") renderQuestions(qnBar, null);
      });
    } else if (msg.type === "error") {
      sending = false;
      holdRun = false;
      paintQueue();
      if (msg.reason === "fingerprint_mismatch") {
        localStorage.removeItem("iris.deviceToken");
        setGateOpen(true);
      }
      setStatusMsg(msg.detail || msg.reason || "error", true);
    }
  });
  socket.addEventListener("close", () => {
    if (ws !== socket) return;
    stopChatPoll();
    sending = false;
    holdRun = false;
    queued = [];
    paintQueue();
    setConnOk(false);
    ws = null;
    const token = localStorage.getItem("iris.deviceToken") || "";
    if (!token) {
      setGateOpen(true);
      setStatusMsg("Disconnected from host", true);
      return;
    }
    setGateOpen(false);
    setStatusMsg("Reconnecting…");
    setTimeout(() => {
      if (ws) return;
      const url = (localStorage.getItem("iris.ws") || hostEl?.value || "ws://127.0.0.1:7842").trim();
      tryPair("", url, { silent: true, token });
    }, 800);
  });
}

function openLegs() {
  ws?.send(JSON.stringify({ type: "status" }));
  showLegsSheet(legs, {
    onAdd: (id) => {
      activeLeg = id || "cursor";
      localStorage.setItem("iris.leg", activeLeg);
      pushPrefs();
      const leg = legs.find((l) => l.id === id);
      setStatusMsg(`Leg · ${leg?.label || activeLeg}`);
      if (!(leg?.connected || leg?.enabled)) {
        ws?.send(JSON.stringify({ type: "setup", leg: activeLeg }));
        showAddWizard(leg || { id, label: id, setup: "Iris is starting the tool for this leg." });
      }
    },
  });
}

const desktopApp = Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
if (desktopApp && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
  });
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (ev) => {
    if (ev.data?.type === "approval") openApproval();
  });
}

function openApproval() {
  renderActionBar(actionBar, ["Allow", "Deny"], (label) => {
    ws?.send(JSON.stringify({ type: "approval", decision: label }));
    renderActionBar(actionBar, []);
    setStatusMsg(label);
  });
}

if (new URLSearchParams(location.search).has("approval")) openApproval();

bindShell({
  onUnpair: unpair,
  getConn: () => !!ws && ws.readyState === WebSocket.OPEN,
  onLegs: openLegs,
  getOverflow: () => ({
    connected: !!ws && ws.readyState === WebSocket.OPEN,
    host: hostEl?.value || "",
    legs: (legs || []).map((l) => l.label || l.id || l.name).filter(Boolean),
  }),
});
syncChips();
refreshUsage();

document.getElementById("pickLegs")?.addEventListener("click", openLegs);

document.getElementById("pickHistory")?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showHistorySheet([], null, { error: "Not paired. Pair with the host, then open History again." });
    return;
  }
  pendingHistory = true;
  showHistorySheet([], activeChatId, { loading: true });
  ws.send(JSON.stringify({ type: "history", leg: activeLeg }));
});

pickPreset?.addEventListener("click", () => {
  showPresetSheet(preset, {
    onPick: (id) => {
      if (!["auto", "manual", "savings", "balanced", "performance", "max"].includes(id || "")) return;
      preset = id;
      localStorage.setItem("iris.preset", id);
      pushPrefs();
      if (!isManual(id)) lastAutoModel = null;
      syncChips();
    },
  });
});

pickModel?.addEventListener("click", () => {
  openModelSheet();
});

function markUnread() {
  document.getElementById("statusBadge")?.classList.add("on");
}

function notifyShade(title, body) {
  markUnread();
  if (typeof Notification === "undefined") return;
  const fire = () => {
    if (Notification.permission !== "granted") return;
    const note = new Notification(title, {
      body,
      tag: "iris-turn",
      icon: "./icon-512.png",
      badge: "./icon-512.png",
    });
    note.onclick = () => {
      window.focus();
      document.getElementById("statusBadge")?.classList.remove("on");
    };
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") Notification.requestPermission().then(fire);
}

async function tryPair(code, wsUrl, { silent = false, token = "" } = {}) {
  const savedToken = token || localStorage.getItem("iris.deviceToken") || "";
  if (!savedToken && !/^\d{6}$/.test(code)) {
    if (!silent) setStatusMsg("Enter the 6-digit code from the host.", true);
    return false;
  }
  if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
    if (!silent) setStatusMsg("Host URL must start with ws:// or wss://", true);
    return false;
  }
  localStorage.setItem("iris.ws", wsUrl);
  localStorage.setItem("iris.pairCode", code);
  if (!silent) setStatusMsg("Connecting…");
  try {
    const old = ws;
    ws = null;
    old?.close();
    const socket = await connect(wsUrl);
    bindSocket(socket);
    socket.send(JSON.stringify(savedToken ? { type: "pair", token: savedToken } : { type: "pair", code }));
    return true;
  } catch (e) {
    if (!silent) {
      setStatusMsg(`Could not reach host: ${e instanceof Error ? e.message : e}`, true);
    }
    setConnOk(false);
    return false;
  }
}

form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  await tryPair((codeEl?.value || "").trim(), (hostEl?.value || "").trim());
});

/** Auto-login: prefer live host code, else last saved localStorage pair. */
(async () => {
  if (localStorage.getItem("iris.deviceToken")) setGateOpen(false);
  let code = (localStorage.getItem("iris.pairCode") || codeEl?.value || "").trim();
  let wsUrl = (localStorage.getItem("iris.ws") || hostEl?.value || "ws://127.0.0.1:7842").trim();
  try {
    const res = await fetch(`/pair-code.json?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const live = await res.json();
      if (/^\d{6}$/.test(String(live.code || ""))) {
        code = String(live.code);
        if (typeof live.ws === "string" && live.ws.startsWith("ws")) wsUrl = live.ws;
      }
      const ladder = Array.isArray(live.rungs) ? live.rungs : [];
      for (const rung of ladder) {
        if (!rung?.ws) continue;
        activeRung = rung.rung || "lan";
        const ok = await tryPair(code, rung.ws, { silent: true });
        if (ok) return;
      }
    }
  } catch {
    /* host may not have published yet */
  }
  if (codeEl && code) codeEl.value = code;
  if (hostEl) hostEl.value = wsUrl;
  const token = localStorage.getItem("iris.deviceToken") || "";
  if (/^\d{6}$/.test(code) || token) {
    setStatusMsg("Auto-pairing…");
    await tryPair(code, wsUrl, { silent: false });
  }
})();

document.getElementById("img")?.addEventListener("click", () => {
  document.getElementById("imgFile")?.click();
});
document.getElementById("imgFile")?.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const blob = await shrinkImage(file);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
    const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
    pendingPhotos.push({ url: dataUrl, data, name: file.name || "photo.jpg", mime: "image/jpeg" });
    paintPhotos();
    setStatusMsg("Photo ready. Send when the note is ready.");
  } catch {
    setStatusMsg("Couldn't read that photo.", true);
  }
});
document.getElementById("photoStrip")?.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-drop-photo]");
  if (!btn) return;
  pendingPhotos.splice(Number(btn.dataset.dropPhoto), 1);
  paintPhotos();
});

document.getElementById("send")?.addEventListener("click", () => {
  const text = (promptEl?.value || "").trim();
  if (!ws || (!text && !pendingPhotos.length)) return;
  promptEl.value = "";
  promptEl.dispatchEvent(new Event("input"));
  closeSheet();
  if (sending) {
    queued.push({ id: `q${++qSeq}`, t: text });
    paintQueue();
    setStatusMsg("Queued");
    return;
  }
  sendPrompt(text);
});

document.getElementById("newChat")?.addEventListener("click", () => {
  activeChatId = null;
  renderChat([], itemsEl, emptyEl);
  sending = false;
  holdRun = false;
  queued = [];
  paintQueue();
  renderQuestions(qnBar, null);
  renderActionBar(actionBar, []);
});

promptEl?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    document.getElementById("send")?.click();
  }
});

document.getElementById("paneOpen")?.addEventListener("click", () => {
  document.getElementById("panePicker")?.classList.add("show");
  document.getElementById("panePickInput")?.focus();
  renderFileHits(editorTabs, "", { onFocus: focusEditor });
});
document.getElementById("panePickInput")?.addEventListener("input", (ev) => {
  renderFileHits(editorTabs, ev.target.value, { onFocus: focusEditor });
});
document.getElementById("panePickCancel")?.addEventListener("click", () => {
  document.getElementById("panePicker")?.classList.remove("show");
});
document.getElementById("paneDiffBack")?.addEventListener("click", () => hideWorkspaceFile());
document.getElementById("tabFiles")?.addEventListener("click", () => {
  ws?.send(JSON.stringify({ type: "editors", leg: activeLeg }));
  ws?.send(JSON.stringify({ type: "changes" }));
});
document.getElementById("tabPane")?.addEventListener("click", () => {
  ws?.send(JSON.stringify({ type: "editors", leg: activeLeg }));
  ws?.send(JSON.stringify({ type: "changes" }));
});

globalThis.__IRIS_PHONE_BOOT__ = true;
