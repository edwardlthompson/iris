/**
 * Pair running Iris debug WebViews over ADB.
 * Usage: node scripts/adb-pair.mjs [code] [ws]
 * Requires `adb reverse tcp:7842 tcp:7842` and a debug build.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const adb = process.env.ADB || "C:\\Program Files (x86)\\Essential\\ADB\\adb.exe";
const code = process.argv[2] || "692817";
const wsUrl = process.argv[3] || "ws://127.0.0.1:7842";

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    socket.addEventListener("open", () => resolve({
      send(method, params = {}) {
        const msgId = ++id;
        return new Promise((res, rej) => {
          pending.set(msgId, { res, rej });
          socket.send(JSON.stringify({ id: msgId, method, params }));
        });
      },
      close() { socket.close(); },
    }));
    socket.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data));
      const waiter = pending.get(msg.id);
      if (!waiter) return;
      pending.delete(msg.id);
      if (msg.error) waiter.rej(new Error(JSON.stringify(msg.error)));
      else waiter.res(msg.result);
    });
    socket.addEventListener("error", () => reject(new Error("cdp error")));
  });
}

const { stdout } = await exec(adb, ["devices"]);
const serials = stdout.split(/\r?\n/).map((l) => l.split("\t")).filter((p) => p[1] === "device").map((p) => p[0]);
let port = 9330;
for (const serial of serials) {
  await exec(adb, ["-s", serial, "reverse", "tcp:7842", "tcp:7842"]);
  const { stdout: pidOut } = await exec(adb, ["-s", serial, "shell", "pidof", "com.edwardlthompson.iris"]);
  const appPid = pidOut.trim().split(/\s+/)[0];
  if (!appPid) {
    console.log(`${serial} Iris not running`);
    continue;
  }
  const local = port++;
  await exec(adb, ["-s", serial, "forward", `tcp:${local}`, `localabstract:webview_devtools_remote_${appPid}`]);
  const pages = await (await fetch(`http://127.0.0.1:${local}/json`)).json();
  const page = pages.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
  if (!page) {
    console.log(`${serial} no webview page`);
    continue;
  }
  const session = await connect(page.webSocketDebuggerUrl.replace("ws://localhost", "ws://127.0.0.1"));
  const expr = `(() => {
    const host = document.getElementById("host");
    const code = document.getElementById("gateInput");
    if (host) host.value = ${JSON.stringify(wsUrl)};
    if (code) code.value = ${JSON.stringify(code)};
    localStorage.setItem("iris.ws", ${JSON.stringify(wsUrl)});
    localStorage.setItem("iris.pairCode", ${JSON.stringify(code)});
    document.getElementById("pair-form")?.requestSubmit();
    return true;
  })()`;
  await session.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  await new Promise((r) => setTimeout(r, 1200));
  const check = await session.send("Runtime.evaluate", {
    expression: `({ token: !!localStorage.getItem("iris.deviceToken"), status: document.getElementById("msg")?.textContent || "", gate: document.getElementById("gate")?.className || "" })`,
    returnByValue: true,
  });
  session.close();
  console.log(serial, JSON.stringify(check.result?.value));
}
