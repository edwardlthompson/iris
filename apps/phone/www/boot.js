const form = document.getElementById("pair-form");
const statusEl = document.getElementById("status");
const codeEl = document.getElementById("code");
const hostEl = document.getElementById("host");

const saved = localStorage.getItem("iris.ws");
if (saved && hostEl) hostEl.value = saved;

function setStatus(msg, kind) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = kind || "";
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
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 8000);
      ws.addEventListener("open", () => {
        clearTimeout(t);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(t);
        reject(new Error("socket error"));
      });
    });
    // Hello frame is encrypted in production; for LAN smoke we just prove TCP reachability.
    ws.close();
    setStatus(`Paired intent stored for ${code}. Host reachable at ${wsUrl}.`, "ok");
  } catch (e) {
    setStatus(`Could not reach host: ${e instanceof Error ? e.message : e}`, "err");
  }
});

globalThis.__IRIS_PHONE_BOOT__ = true;
