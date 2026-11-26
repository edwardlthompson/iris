#!/usr/bin/env node
/**
 * Sprint 15 acceptance: each packaging recipe dry-runs an installable stub
 * into dist/packaging-artifacts (gitignored via dist/).
 */
import { spawn } from "node:child_process";
import { access, readFile, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const artifacts = join(root, "dist/packaging-artifacts");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (c) => {
      err += c;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} → ${code}\n${err}`));
    });
  });
}

export async function buildAllDryRun({ withLiteLlm = false } = {}) {
  const litellm = withLiteLlm ? ["--with-litellm"] : [];
  await run(process.execPath, [join(here, "android/build-unsigned.mjs"), "--dry-run"]);
  await run(process.execPath, [join(here, "windows/build-msi.mjs"), "--dry-run", ...litellm]);
  await run(process.execPath, [join(here, "linux/build-deb.mjs"), "--dry-run", ...litellm]);
}

export async function assertArtifactsPresent() {
  const required = [
    "iris-unsigned.apk.stub",
    "android.meta.json",
    "iris-tray.msi.stub",
    "windows.meta.json",
    "iris_0.0.0_amd64.deb.stub",
    "linux.meta.json",
    "iris.service",
  ];
  for (const name of required) {
    await access(join(artifacts, name), constants.R_OK);
  }
  const android = JSON.parse(await readFile(join(artifacts, "android.meta.json"), "utf8"));
  const windows = JSON.parse(await readFile(join(artifacts, "windows.meta.json"), "utf8"));
  const linux = JSON.parse(await readFile(join(artifacts, "linux.meta.json"), "utf8"));
  if (!android.capacitor || android.signed !== false) {
    throw new Error("android meta must be unsigned Capacitor APK");
  }
  if (!windows.tray) throw new Error("windows meta must enable tray");
  if (linux.unit !== "iris.service") throw new Error("linux meta missing systemd unit");
  return { android, windows, linux };
}

export async function verifyPackaging() {
  await access(join(root, "apps/phone/capacitor.config.json"), constants.R_OK);
  await buildAllDryRun();
  return assertArtifactsPresent();
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, "/").endsWith(
    process.argv[1].replace(/\\/g, "/").split("/").slice(-2).join("/"),
  );

if (isMain || process.argv[1]?.endsWith("verify-artifacts.mjs")) {
  verifyPackaging()
    .then((meta) => {
      console.log("packaging verify OK", Object.keys(meta).join(","));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
