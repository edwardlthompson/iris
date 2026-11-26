#!/usr/bin/env node
/** Static serve apps/phone/www for ADB / LAN pairing smoke. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../apps/phone/www");
const port = Number(process.env.IRIS_PHONE_PORT ?? 8787);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1`);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const noStore = {
    "cache-control": "no-store, max-age=0",
  };
  try {
    // Live pairing code published by iris-host into ~/.iris/pair-code.json
    if (path === "/pair-code.json") {
      const body = await readFile(join(homedir(), ".iris", "pair-code.json"));
      res.writeHead(200, { "content-type": "application/json", ...noStore });
      res.end(body);
      return;
    }
    const body = await readFile(join(root, path.replace(/^\//, "")));
    const ext = extname(path);
    const headers = {
      "content-type": types[ext] ?? "application/octet-stream",
      "cache-control":
        ext === ".html" || ext === ".js" || ext === ".css" || ext === ".json"
          ? "no-store, max-age=0"
          : "public, max-age=3600",
    };
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Iris phone PWA http://0.0.0.0:${port}/ (ADB: adb reverse tcp:${port} tcp:${port})`);
});
