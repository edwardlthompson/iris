#!/usr/bin/env node
/** Static serve apps/phone/www for ADB / LAN pairing smoke. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../apps/phone/www");
const port = Number(process.env.IRIS_PHONE_PORT ?? 8787);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1`);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const body = await readFile(join(root, path.replace(/^\//, "")));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Iris phone PWA http://0.0.0.0:${port}/ (ADB: adb reverse tcp:${port} tcp:${port})`);
});
