import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync("C:/Users/edwar/cursor-remote-lite/app/index.html", "utf8");
const start = src.indexOf("<style>");
const end = src.indexOf("</style>");
if (start < 0 || end < 0) throw new Error("style block missing");
let css = src.slice(start + 7, end).trim();
// Drop live-screen / CDP banner chrome — Iris has no Screen tab.
css = css.replace(/#liveBanner[\s\S]*?(?=\n {2}#composerDock)/, "");
css = css.replace(/#dashStrip \{ display: none !important; \}\n/, "");

const outDir = join(root, "www", "css");
mkdirSync(outDir, { recursive: true });
const lines = css.split(/\r?\n/);
const mid = Math.ceil(lines.length / 2);
writeFileSync(join(outDir, "remote-a.css"), `${lines.slice(0, mid).join("\n")}\n`, "utf8");
writeFileSync(join(outDir, "remote-b.css"), `${lines.slice(mid).join("\n")}\n`, "utf8");
console.log(`wrote remote-a.css (${mid}) remote-b.css (${lines.length - mid})`);
