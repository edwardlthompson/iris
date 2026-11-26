#!/usr/bin/env node
/**
 * Unsigned APK recipe (Capacitor).
 * --dry-run writes a stub artifact under packaging/.artifacts/ (no SDK required).
 */
import { mkdir, writeFile, copyFile, access, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const wwwIndex = join(root, "apps/phone/www/index.html");
const outDir = join(root, "dist/packaging-artifacts");
const dry = process.argv.includes("--dry-run");

await access(wwwIndex, constants.R_OK);
await mkdir(outDir, { recursive: true });

const meta = {
  kind: "android-unsigned-apk",
  appId: "com.edwardlthompson.iris",
  source: "apps/phone",
  capacitor: true,
  signed: false,
  dryRun: dry,
  builtAt: new Date().toISOString(),
};

const apkPath = join(outDir, "iris-unsigned.apk.stub");
await writeFile(apkPath, `Iris unsigned APK stub\n${JSON.stringify(meta, null, 2)}\n`);
await copyFile(wwwIndex, join(outDir, "www-index.html"));
await writeFile(join(outDir, "android.meta.json"), JSON.stringify(meta, null, 2));
console.log(`android artifact: ${apkPath}`);
