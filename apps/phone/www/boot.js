import {
  bindShell,
  closeSheet,
  setConnOk,
  setGateOpen,
  setMode,
  setComposerCollapsed,
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
  showRepoSheet,
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
let fileInventory = [];
let pickTimer = 0;
const pickerQuery = () => document.getElementById("panePickInput")?.value || "";
const paintPicker = () => renderFileHits(editorTabs, pickerQuery(), { onFocus: pickFile, inventory: fileInventory });
function pickFile(name) {
  rememberOpen(name);
  document.getElementById("panePicker")?.classList.remove("show");
  document.getElementById("panePickHits")?.classList.remove("show");
  ws?.send(JSON.stringify({ type: "file", name }));
  setStatusMsg(`Opening ${name}…`);
}

function paintOpenFiles() {
  const names = loadOpenFiles();
  editorTabs = names.map((name, i) => ({ name, label: name, disk: true, active: i === 0 }));
  renderEditorTabs(editorTabs, { onFocus: focusEditor });
}

function normKey(path) {
  return String(path || "default").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function repoKey() {
  return normKey(lockedRepo?.path || localStorage.getItem("iris.repoKey") || "default");
}

function workspaceMap() {
  try {
    const all = JSON.parse(localStorage.getItem("iris.workspace") || "{}");
    return all && typeof all === "object" ? all : {};
  } catch {
    return {};
  }
}

function workspace() {
  return workspaceMap()[repoKey()] || {};
}

function saveWorkspace(patch) {
  const all = workspaceMap();
  all[repoKey()] = { ...(all[repoKey()] || {}), ...patch };
  localStorage.setItem("iris.workspace", JSON.stringify(all));
}

function loadOpenFiles() {
  const saved = workspace().files;
  if (Array.isArray(saved)) return saved.filter((name) => typeof name === "string" && name);
  try {
    const list = JSON.parse(localStorage.getItem("iris.openFiles") || "[]");
    return Array.isArray(list) ? list.filter((name) => typeof name === "string" && name) : [];
  } catch {
    return [];
  }
}

function rememberOpen(name) {
  const list = [name, ...loadOpenFiles().filter((n) => n !== name)].slice(0, 20);
  saveWorkspace({ files: list });
  paintOpenFiles();
}
let editorPoll = null;
let pendingHistory = false;
let pendingRepos = false;
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
  return isManual(preset) ? pickedModel : autoModelForPreset(preset, lastAutoModel, activeLeg, models);
}

function syncChips() {
  renderCostChip(document.getElementById("costChip"), preset, activeModelId());
  if (pickPreset) {
    pickPreset.textContent = presetLabel(preset);
    pickPreset.title = "Performance mode";
  }
  if (pickModel) {
    const manual = isManual(preset);
    pickModel.hidden = !manual;
    pickModel.style.display = manual ? "" : "none";
    if (manual) {
      pickModel.textContent = modelShortLabel(pickedModel);
      pickModel.title = "Manual model";
      pickModel.classList.remove("auto");
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
      ws.send(JSON.stringify({ type: "changes" }));
    }
  }, 2500);
}

function focusEditor(name) {
  if (!name) return;
  rememberOpen(name);
  ws?.send(JSON.stringify({ type: "file", name }));
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

function connect(wsUrl, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const t = setTimeout(() => {
      socket.close();
      reject(new Error("timeout"));
    }, timeoutMs);
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
    activeLeg,
    onPick: (id) => {
      if (locked) return;
      pickedModel = id;
      localStorage.setItem("iris.model", id);
      const pickedObj = (models || []).find((m) => (m.id || m) === id);
      if (pickedObj?.leg) {
        activeLeg = pickedObj.leg;
        localStorage.setItem("iris.leg", activeLeg);
      }
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

let lockedRepo = null;

function paintRepo(lock) {
  const prev = repoKey();
  lockedRepo = lock || lockedRepo;
  const chip = document.getElementById("repoChip");
  if (!chip || !lockedRepo?.name) return;
  const next = normKey(lockedRepo.path);
  const all = workspaceMap();
  if (prev === "default" && next !== "default" && !all[next]?.files?.length && all.default?.files?.length) {
    all[next] = { ...(all[next] || {}), ...all.default, files: all.default.files };
    localStorage.setItem("iris.workspace", JSON.stringify(all));
  }
  localStorage.setItem("iris.repoKey", next);
  localStorage.setItem("iris.repoName", lockedRepo.name);
  chip.hidden = false;
  chip.textContent = lockedRepo.name;
  chip.title = lockedRepo.path || lockedRepo.name;
  const saved = workspace();
  if (saved.mode) setMode(saved.mode);
  if (saved.composer) setComposerCollapsed(saved.composer === "collapsed");
  paintOpenFiles();
  if (prev !== next) {
    fileInventory = [];
    ws?.send(JSON.stringify({ type: "file_index" }));
  }
}

function applyPaired(msg) {
  if (msg.token) localStorage.setItem("iris.deviceToken", msg.token);
  setGateOpen(false);
  applyShared(msg.prefs);
  setStatusMsg(`Paired · ${activeRung}`);
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  startChatPoll();
  ws?.send(JSON.stringify({ type: "chat" }));
  ws?.send(JSON.stringify({ type: "repos" }));
  ws?.send(JSON.stringify({ type: "file_index" }));
  applySnap(msg);
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
      applyPaired(msg);
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
        onOpen: (name) => ws?.send(JSON.stringify({ type: "file", name })),
      });
    } else if (msg.type === "diff") {
      showDiff(msg);
    } else if (msg.type === "editors") {
      if (pickerQuery().trim()) renderFileHits(msg.tabs || [], pickerQuery(), { onFocus: pickFile, inventory: fileInventory });
    } else if (msg.type === "file_index") {
      fileInventory = msg.files || [];
      paintPicker();
    } else if (msg.type === "repos") {
      paintRepo(msg.lock);
      if (pendingRepos) {
        pendingRepos = false;
        showRepoSheet(msg.repos || [], msg.lock?.path || "", {
          onPick: (path) => {
            if (!path) return;
            ws?.send(JSON.stringify({ type: "repo_lock", path }));
          },
        });
      }
    } else if (msg.type === "repo_alert") {
      const banner = document.getElementById("repoAlert");
      if (!banner) return;
      const rows = msg.mismatches || [];
      if (!rows.length) {
        banner.hidden = true;
        banner.textContent = "";
        return;
      }
      banner.hidden = false;
      banner.textContent = rows
        .map((row) => `${row.program} is open on “${row.title}”, not ${msg.repo || "the locked repo"}. That program will be skipped.`)
        .join(" ");
    } else if (msg.type === "tool_approval") {
      renderActionBar(actionBar, ["Allow", "Deny"], (label) => {
        ws.send(JSON.stringify({ type: "approval", id: msg.id, decision: label }));
        renderActionBar(actionBar, []);
      });
      setStatusMsg(msg.summary || "Approve this step");
    } else if (msg.type === "history") {
      if (!pendingHistory) return;
      pendingHistory = false;
      showHistorySheet(msg.conversations || [], activeChatId, {
        error: msg.error || "",
        repo: lockedRepo?.name || "",
        onPick: (id) => {
          activeChatId = id === "unified" ? null : id;
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
      const dest =
        msg.leg === "antigravity" ? "Antigravity"
          : msg.leg === "pool" ? "Venice Pool"
          : msg.leg === "claude" ? "Claude Code"
          : "Cursor";
      const effort = msg.effort ? ` · ${msg.effort}` : "";
      const doneText = `${modelShortLabel(msg.pickedModel || msg.model || "Auto")}${effort} · ${dest}`;
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
    const again = () => {
      if (ws) return;
      void walkRungs(savedRungs(), "", token).then((ok) => {
        if (!ok && !ws) setTimeout(again, 3000);
      });
    };
    setTimeout(again, 800);
  });
}

function openLegs() {
  ws?.send(JSON.stringify({ type: "status" }));
  showLegsSheet(legs, {
    activeLeg,
    onAdd: (id) => {
      activeLeg = id || "cursor";
      localStorage.setItem("iris.leg", activeLeg);
      syncChips();
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

document.getElementById("repoChip")?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  pendingRepos = true;
  ws.send(JSON.stringify({ type: "repos" }));
});

document.getElementById("pickHistory")?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showHistorySheet([], null, { error: "Not paired. Pair with the host, then open History again." });
    return;
  }
  pendingHistory = true;
  showHistorySheet([], activeChatId, { loading: true, repo: lockedRepo?.name || "" });
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
  if (!isManual(preset)) return;
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
  if (code) localStorage.setItem("iris.pairCode", code);
  if (!silent) setStatusMsg("Connecting…");
  try {
    const opened = await openPaired(wsUrl, code, savedToken, 8000);
    if (!opened) {
      if (!ws || ws.readyState !== WebSocket.OPEN) setConnOk(false);
      return false;
    }
    const old = ws;
    if (old && old !== opened.socket) {
      ws = null;
      old.close();
    }
    bindSocket(opened.socket);
    applyPaired(opened.msg);
    localStorage.setItem("iris.ws", wsUrl);
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

function savedRungs() {
  try {
    const list = JSON.parse(localStorage.getItem("iris.rungs") || "[]");
    if (Array.isArray(list) && list.length) return list;
  } catch {
    /* ignore bad storage */
  }
  const url = (localStorage.getItem("iris.ws") || "ws://127.0.0.1:7842").trim();
  return [{ rung: "lan", ws: url }];
}

function isDesktop() {
  return !!(
    window.__TAURI_INTERNALS__ ||
    window.__TAURI__ ||
    location.hostname === "tauri.localhost"
  );
}

function isTunnel(rung) {
  return rung?.rung === "tunnel" || String(rung?.ws || "").startsWith("wss://");
}

/** Phones stay on the tunnel, then LAN. 127.0.0.1 is the USB reverse and dies when the cable comes out. */
function remoteOrder(rungs) {
  const usable = rungs.filter((r) => r?.ws && !String(r.ws).includes("172.31.") && !String(r.ws).includes("127.0.0.1"));
  const tunnel = usable.filter(isTunnel);
  const lan = usable.filter((r) => !isTunnel(r));
  return [...tunnel, ...lan];
}

function openPaired(wsUrl, code, token, timeoutMs) {
  return connect(wsUrl, timeoutMs).then(
    (socket) =>
      new Promise((resolve) => {
        let settled = false;
        let last = null;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          socket.removeEventListener("message", onMsg);
          socket.removeEventListener("close", onClose);
          if (!ok) socket.close();
          resolve(ok ? { socket, msg: last } : null);
        };
        const onMsg = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data));
            last = msg;
            if (msg.type === "paired") finish(true);
            else if (msg.type === "error") finish(false);
          } catch {
            /* ignore non-json */
          }
        };
        const onClose = () => finish(false);
        socket.addEventListener("message", onMsg);
        socket.addEventListener("close", onClose);
        setTimeout(() => finish(false), timeoutMs);
        socket.send(JSON.stringify(token ? { type: "pair", token } : { type: "pair", code }));
      }),
  );
}

/** Move off the tunnel only onto a real LAN address. Never onto 127.0.0.1. */
async function upgradeFromTunnel(local, code, token) {
  const held = ws;
  for (const rung of local) {
    if (!rung?.ws || String(rung.ws).includes("127.0.0.1") || ws !== held) continue;
    try {
      const opened = await openPaired(rung.ws, code, token, 2500);
      if (!opened?.socket || ws !== held) {
        opened?.socket?.close();
        continue;
      }
      ws = null;
      held.close();
      activeRung = "lan";
      bindSocket(opened.socket);
      applyPaired(opened.msg);
      localStorage.setItem("iris.ws", rung.ws);
      setStatusMsg("Paired · lan");
      return;
    } catch {
      /* stay on the tunnel */
    }
  }
}

async function walkRungs(rungs, code, token) {
  localStorage.setItem("iris.rungs", JSON.stringify(rungs));
  const order = isDesktop() ? rungs.filter((r) => r?.ws) : remoteOrder(rungs);
  if (!isDesktop()) {
    const tunnel = order.find(isTunnel);
    if (tunnel) {
      activeRung = "tunnel";
      if (await tryPair(code, tunnel.ws, { silent: true, token })) {
        void upgradeFromTunnel(
          order.filter((r) => r !== tunnel),
          code,
          token,
        );
        return true;
      }
    }
  }
  for (const rung of order) {
    if (!rung?.ws) continue;
    activeRung = String(rung.ws).includes("127.0.0.1") ? "adb" : rung.rung || "lan";
    if (await tryPair(code, rung.ws, { silent: true, token })) return true;
  }
  return false;
}

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
      if (ladder.length && (await walkRungs(ladder, code, ""))) return;
    }
  } catch {
    /* bundled apps have no pair-code.json */
  }
  if (!/^\d{6}$/.test(code)) {
    try {
      const res = await fetch(`http://127.0.0.1:8787/pair-code.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const live = await res.json();
        if (/^\d{6}$/.test(String(live.code || ""))) code = String(live.code);
        const ladder = Array.isArray(live.rungs) ? live.rungs : [];
        if (ladder.length && (await walkRungs(ladder, code, ""))) return;
      }
    } catch {
      /* phone server is not on this machine */
    }
  }
  if (await walkRungs(savedRungs(), code, localStorage.getItem("iris.deviceToken") || "")) return;
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
  paintPicker();
  ws?.send(JSON.stringify({ type: "file_index" }));
});
document.getElementById("panePickInput")?.addEventListener("input", () => {
  paintPicker(); // instant, predictive: filter the cached inventory on every keystroke
  clearTimeout(pickTimer);
  if (!fileInventory.length) pickTimer = setTimeout(() => ws?.send(JSON.stringify({ type: "editors", leg: activeLeg, query: pickerQuery() })), 120);
});
document.getElementById("panePickInput")?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    document.querySelector("#panePickHits [data-file]")?.click();
  }
});
document.getElementById("panePickGo")?.addEventListener("click", () => {
  const first = document.querySelector("#panePickHits [data-file]");
  if (first) first.click();
  else if (pickerQuery().trim()) pickFile(pickerQuery().trim());
});
document.getElementById("panePickCancel")?.addEventListener("click", () => {
  document.getElementById("panePicker")?.classList.remove("show");
});
document.getElementById("paneDiffBack")?.addEventListener("click", () => hideWorkspaceFile());
document.getElementById("tabFiles")?.addEventListener("click", () => {
  paintOpenFiles();
  ws?.send(JSON.stringify({ type: "file_index" }));
  ws?.send(JSON.stringify({ type: "changes" }));
});
document.getElementById("tabPane")?.addEventListener("click", () => {
  paintOpenFiles();
  ws?.send(JSON.stringify({ type: "file_index" }));
  ws?.send(JSON.stringify({ type: "changes" }));
});

globalThis.__IRIS_PHONE_BOOT__ = true;
const savedRepoName = localStorage.getItem("iris.repoName");
const savedChip = document.getElementById("repoChip");
if (savedChip && savedRepoName) {
  savedChip.hidden = false;
  savedChip.textContent = savedRepoName;
}
paintOpenFiles();
