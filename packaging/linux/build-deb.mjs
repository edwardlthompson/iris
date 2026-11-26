#!/usr/bin/env node
/**
 * Linux deb + systemd unit recipe.
 * --dry-run writes stub under packaging/.artifacts/.
 */
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const outDir = join(root, "dist/packaging-artifacts");
const dry = process.argv.includes("--dry-run");
const withLiteLlm = process.argv.includes("--with-litellm");

const unit = await readFile(join(here, "iris.service"), "utf8");
const control = await readFile(join(here, "debian/control"), "utf8");
await mkdir(outDir, { recursive: true });

const meta = {
  kind: "linux-deb-systemd",
  unit: "iris.service",
  litellmComponent: withLiteLlm ? "optional-included" : "optional-disabled",
  litellmBind: "127.0.0.1",
  dryRun: dry,
  unitBytes: Buffer.byteLength(unit, "utf8"),
  controlBytes: Buffer.byteLength(control, "utf8"),
  builtAt: new Date().toISOString(),
};

const debPath = join(outDir, "iris_0.0.0_amd64.deb.stub");
await writeFile(debPath, `Iris deb stub\n${JSON.stringify(meta, null, 2)}\n`);
await copyFile(join(here, "iris.service"), join(outDir, "iris.service"));
await writeFile(join(outDir, "linux.meta.json"), JSON.stringify(meta, null, 2));
console.log(`linux artifact: ${debPath}`);
