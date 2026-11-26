#!/usr/bin/env node
/**
 * Windows tray MSI recipe. Optional LiteLLM component is off unless pool mode.
 * --dry-run writes stub under packaging/.artifacts/.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const outDir = join(root, "dist/packaging-artifacts");
const dry = process.argv.includes("--dry-run");
const withLiteLlm = process.argv.includes("--with-litellm");

const wxs = await readFile(join(here, "iris-tray.wxs"), "utf8");
await mkdir(outDir, { recursive: true });

const meta = {
  kind: "windows-msi-tray",
  product: "Iris",
  tray: true,
  litellmComponent: withLiteLlm ? "optional-included" : "optional-disabled",
  litellmBind: "127.0.0.1",
  dryRun: dry,
  wxsBytes: Buffer.byteLength(wxs, "utf8"),
  builtAt: new Date().toISOString(),
};

const msiPath = join(outDir, "iris-tray.msi.stub");
await writeFile(msiPath, `Iris tray MSI stub\n${JSON.stringify(meta, null, 2)}\n`);
await writeFile(join(outDir, "windows.meta.json"), JSON.stringify(meta, null, 2));
console.log(`windows artifact: ${msiPath}`);
