const form = document.getElementById("pair-form");
const statusEl = document.getElementById("status");
const codeEl = document.getElementById("code");
const hostEl = document.getElementById("host");
const pairPanel = document.getElementById("pair-panel");
const remote = document.getElementById("remote");
const legsEl = document.getElementById("legs");
const promptEl = document.getElementById("prompt");
const logEl = document.getElementById("log");

let ws = null;

const saved = localStorage.getItem("iris.ws");
if (saved && hostEl) hostEl.value = saved;
else if (hostEl) hostEl.value = "ws://127.0.0.1:7842";

function setStatus(msg, kind) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = kind || "";
}

function log(line) {
  if (!logEl) return;
  logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 4000);
}

function showRemote(on) {
  pairPanel?.classList.toggle("hidden", on);
  remote?.classList.toggle("active", on);
}

function renderLegs(payload) {
  const best = payload.bestLeg || "none";
  const rows = (payload.legs || [])
    .map((l) => {
      const state = l.enabled ? "ready" : l.disabledReason || "off";
      return `${l.id}: ${state}${l.model ? ` · ${l.model}` : ""}`;
    })
    .join("\n");
  if (legsEl) legsEl.textContent = `Best: ${best}\n${rows || "(no legs)"}`;
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

function bindSocket(socket) {
  ws = socket;
  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (msg.type === "paired") {
      renderLegs(msg);
      showRemote(true);
      setStatus(`Paired · session ${msg.sessionId}`, "ok");
      log(`paired best=${msg.bestLeg}`);
    } else if (msg.type === "status") {
      renderLegs(msg);
      log(`status best=${msg.bestLeg}`);
    } else if (msg.type === "prompt_result") {
      log(`${msg.leg}/${msg.model}: ${msg.text}`);
      setStatus(
        msg.stopReason === "bridge_pending" ? "Routed (IDE bridge still pending)" : "Done",
        "ok",
      );
    } else if (msg.type === "error") {
      setStatus(msg.detail || msg.reason || "error", "err");
      log(`error ${msg.reason}`);
    }
  });
  ws.addEventListener("close", () => {
    setStatus("Disconnected from host", "err");
    showRemote(false);
    ws = null;
  });
}

form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const code = (codeEl?.value || "").trim();
  const wsUrl = (hostEl?.value || "").trim();
  if (!/^\d{6}$/.test(code)) {
    setStatus("Enter the 6-digit code from the host.", "err");
    return;
  }
  if (!wsUrl.startsWith("ws://") && !wsUrl.startsWith("wss://")) {
    setStatus("Host URL must start with ws:// or wss://", "err");
    return;
  }
  localStorage.setItem("iris.ws", wsUrl);
  localStorage.setItem("iris.pairCode", code);
  setStatus("Connecting…");
  try {
    if (ws) ws.close();
    const socket = await connect(wsUrl);
    bindSocket(socket);
    socket.send(JSON.stringify({ type: "pair", code }));
  } catch (e) {
    setStatus(`Could not reach host: ${e instanceof Error ? e.message : e}`, "err");
  }
});

document.getElementById("send")?.addEventListener("click", () => {
  const text = (promptEl?.value || "").trim();
  if (!ws || !text) return;
  ws.send(JSON.stringify({ type: "prompt", text }));
  setStatus("Sending…");
});

document.getElementById("refresh")?.addEventListener("click", () => {
  ws?.send(JSON.stringify({ type: "status" }));
});

document.getElementById("unpair")?.addEventListener("click", () => {
  ws?.close();
  showRemote(false);
  setStatus("Disconnected");
});

globalThis.__IRIS_PHONE_BOOT__ = true;
