#!/usr/bin/env node
/** Ensure Capacitor webDir exists (idempotent for packaging dry-runs). */
import { access, constants } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const index = join(root, "www", "index.html");
await access(index, constants.R_OK);
console.log(`www ok: ${index}`);
