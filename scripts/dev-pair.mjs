#!/usr/bin/env node
/**
 * Dev pairing helper: start host + phone static server.
 * Usage: node scripts/dev-pair.mjs
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, name) {
  const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    console.error(`${name} exited`, code);
    process.exit(code ?? 1);
  });
  return child;
}

const host = run("pnpm", ["--filter", "@iris/host", "start"], "host");
const phone = run(process.execPath, [join(root, "scripts/serve-phone.mjs")], "phone");

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    host.kill();
    phone.kill();
  });
}
