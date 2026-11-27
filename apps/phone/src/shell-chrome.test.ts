import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const www = join(dirname(fileURLToPath(import.meta.url)), "..", "www");

function read(name: string): string {
  return readFileSync(join(www, name), "utf8");
}

describe("@iris/phone shell chrome (remote absorb)", () => {
  it("ships Chat / Dual pane / Files and forbids Screen", () => {
    const html = read("index.html");
    expect(html).toMatch(/id="tabChat"/);
    expect(html).toMatch(/id="tabPane"/);
    expect(html).toMatch(/id="tabFiles"/);
    expect(html).not.toMatch(/tabScreen|screenView|id="liveBanner"/);
    expect(html).toMatch(/id="gate"/);
    expect(html).toMatch(/id="pair-form"/);
    expect(html).toMatch(/id="actionBar"/);
    expect(html).toMatch(/id="qnBar"/);
    expect(html).toMatch(/id="queueBar"/);
    expect(html).toMatch(/css\/remote-a\.css/);
    expect(html).toMatch(/composer-actions/);
    expect(html).toMatch(/id="pickHistory"/);
    expect(html).toMatch(/id="newChat"/);
    expect(html).toMatch(/id="pickPreset"/);
    expect(html).toMatch(/id="pickModel"/);
    expect(html.indexOf("pickPreset")).toBeLessThan(html.indexOf("pickModel"));
    expect(html).toMatch(/id="pickPreset"/);
    expect(html).toMatch(/id="pickModel"/);
    expect(html.indexOf("pickPreset")).toBeLessThan(html.indexOf("pickModel"));
  });

  it("ports cursor-remote-lite VS Code dark tokens", () => {
    const html = read("index.html");
    const a = read("css/remote-a.css");
    expect(html).toMatch(/theme-color" content="#1e1e1e"/);
    expect(a).toMatch(/#1e1e1e/);
    expect(a).toMatch(/#0e639c/);
    expect(a).toMatch(/\.human \.bubble/);
  });

  it("shell modules have no Screen / CDP frame paths", () => {
    const js = read("shell.js");
    expect(js).toMatch(/export function setMode/);
    expect(js).not.toMatch(/screenView|tabScreen|onFrame/);
  });

  it("Performance sheet leads with Auto; model chip tracks auto pick", () => {
    const tools = read("tools-ui.js");
    const html = read("index.html");
    const boot = read("boot.js");
    expect(tools.indexOf('id: "auto"')).toBeLessThan(tools.indexOf('id: "manual"'));
    expect(tools.indexOf('id: "manual"')).toBeLessThan(tools.indexOf('id: "savings"'));
    expect(tools).toMatch(/grok-4\.7:xhigh/);
    expect(tools).toMatch(/renderUsageBar/);
    expect(tools).toMatch(/Switch to Manual/);
    expect(html).toMatch(/id="pickModel"[^>]*class="auto"/);
    expect(html).not.toMatch(/id="pickModel"[^>]*hidden/);
    expect(boot).toMatch(/Auto-pairing/);
    expect(boot).toMatch(/modelShortLabel\((pickedModel)\)/);
    expect(boot).toMatch(/renderUsageBar/);
  });

  it("wires approval, questionnaire, and queue bars", () => {
    const bars = read("bars-ui.js");
    const boot = read("boot.js");
    expect(bars).toMatch(/export function renderActionBar/);
    expect(bars).toMatch(/export function renderQuestions/);
    expect(bars).toMatch(/export function renderQueue/);
    expect(boot).toMatch(/renderActionBar/);
    expect(boot).toMatch(/renderQuestions/);
    expect(boot).toMatch(/type: "approval"/);
    expect(boot).toMatch(/type: "question"/);
  });

  it("renders changed files and diffs and forbids Screen", () => {
    const files = read("files-ui.js");
    const boot = read("boot.js");
    const html = read("index.html");
    expect(files).toMatch(/export function renderChangedFiles/);
    expect(files).toMatch(/export function showDiff/);
    expect(boot).toMatch(/type: "changes"/);
    expect(boot).toMatch(/type === "diff"/);
    expect(html).not.toMatch(/id="tabScreen"/);
  });

  it("shows a composer cost estimate chip", () => {
    const cost = read("cost-ui.js");
    const boot = read("boot.js");
    const html = read("index.html");
    expect(html).toMatch(/id="costChip"/);
    expect(cost).toMatch(/~\$/);
    expect(cost).toMatch(/1\.58/);
    expect(boot).toMatch(/renderCostChip/);
  });

  it("overflow sheet covers connection, legs, reload, and unpair", () => {
    const shell = read("shell.js");
    const boot = read("boot.js");
    expect(shell).toMatch(/Reload UI/);
    expect(shell).toMatch(/Disconnect/);
    expect(shell).toMatch(/data-act="legs"/);
    expect(shell).toMatch(/Connected/);
    expect(boot).toMatch(/getOverflow/);
  });

  it("registers a service worker and opens approvals from a push deep link", () => {
    const sw = read("sw.js");
    const boot = read("boot.js");
    const manifest = read("manifest.webmanifest");
    expect(manifest).toMatch(/#1e1e1e/);
    expect(sw).toMatch(/caches\.open/);
    expect(sw).toMatch(/notificationclick/);
    expect(sw).toMatch(/approval/);
    expect(boot).toMatch(/serviceWorker\.register/);
    expect(boot).toMatch(/approval/);
  });
});
