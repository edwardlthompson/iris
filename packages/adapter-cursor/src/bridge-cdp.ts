import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CursorBridge } from "./driver.js";
import { connectCdp, listWorkbenchTargets, pickAgentsTarget } from "./cdp.js";
import { selectCursorModelEffort } from "./model-picker-cdp.js";
import type { GrokEffort } from "./models.js";

const FOCUS_COMPOSER = `(() => {
  const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const selectors = [
    '.aislash-editor-input[contenteditable="true"]',
    '.ui-prompt-input-editor__input[contenteditable="true"]',
    '.composer-bar [contenteditable="true"]',
    '.auxiliarybar [contenteditable="true"]'
  ];
  let eds = [];
  for (const s of selectors) { eds = [...document.querySelectorAll(s)].filter(visible); if (eds.length) break; }
  if (!eds.length) return null;
  const el = eds.find(e => e.contains(document.activeElement)) || eds[eds.length - 1];
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
})()`;

async function pressEnter(session: Awaited<ReturnType<typeof connectCdp>>): Promise<void> {
  const ev = {
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    text: "\r",
  };
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", ...ev });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...ev });
}

async function typeText(
  session: Awaited<ReturnType<typeof connectCdp>>,
  text: string,
): Promise<void> {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      await session.send("Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        modifiers: 8,
      });
      await session.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        modifiers: 8,
      });
    }
    if (lines[i]) await session.send("Input.insertText", { text: lines[i] });
  }
}

async function attachImages(
  session: Awaited<ReturnType<typeof connectCdp>>,
  images: { data: string; name?: string; type?: string }[],
): Promise<void> {
  await session.send("DOM.enable").catch(() => {});
  const doc = (await session.send("DOM.getDocument", { depth: 0 })) as {
    root?: { nodeId?: number };
  };
  const rootId = doc.root?.nodeId;
  if (!rootId) throw new Error("Cursor composer is not open");
  const selectors = [
    ".agent-prompt-input-root input[type=file]",
    ".ui-prompt-input-toolbar input[type=file]",
    'input[type=file][accept*="image"]',
    "input[type=file]",
  ];
  let nodeId = 0;
  for (const selector of selectors) {
    const found = (await session.send("DOM.querySelector", { nodeId: rootId, selector })) as {
      nodeId?: number;
    };
    if (found?.nodeId) {
      nodeId = found.nodeId;
      break;
    }
  }
  if (!nodeId) throw new Error("Cursor has no photo button in the Agent chat");
  const files: string[] = [];
  try {
    for (const [i, image] of images.slice(0, 4).entries()) {
      const path = join(tmpdir(), `iris-photo-${Date.now()}-${i}.jpg`);
      await writeFile(path, Buffer.from(image.data, "base64"));
      files.push(path);
    }
    await session.send("DOM.setFileInputFiles", { nodeId, files });
    setTimeout(() => {
      for (const path of files) void unlink(path).catch(() => {});
    }, 4000);
  } catch (err) {
    for (const path of files) void unlink(path).catch(() => {});
    throw err;
  }
}

export type CdpBridgeOpts = {
  cdpHttp?: string;
  /** When false, insert text but do not press Enter. Default true. */
  submit?: boolean;
};

/** Drive Cursor Agent/Composer via CDP (requires Cursor started with --remote-debugging-port=9222). */
export function createCdpCursorBridge(opts: CdpBridgeOpts = {}): CursorBridge {
  const cdpHttp = opts.cdpHttp ?? "http://127.0.0.1:9222";
  const submit = opts.submit !== false;

  return {
    async send({ prompt, model, effort, pickerLabel, signal, images }) {
      if (signal?.aborted) throw new Error("aborted");
      const targets = await listWorkbenchTargets(cdpHttp);
      const target = pickAgentsTarget(targets);
      if (!target) {
        throw new Error(
          "Cannot reach Cursor CDP workbench. Start Cursor with --remote-debugging-port=9222 (start-cursor.ps1).",
        );
      }
      const session = await connectCdp(target.ws);
      try {
        if (signal?.aborted) throw new Error("aborted");
        await session.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});

        let modelSelect = "skipped";
        if (pickerLabel && effort) {
          const sel = await selectCursorModelEffort(session, {
            pickerLabel,
            effort: effort as GrokEffort,
          });
          modelSelect = sel.ok ? sel.detail : `soft_fail:${sel.detail}`;
        }

        const found = await session.evaluate(FOCUS_COMPOSER);
        if (!found) {
          throw new Error("No visible chat input: open the Agent panel in Cursor first");
        }
        if (images?.length) await attachImages(session, images);
        await typeText(session, prompt.slice(0, 100_000));
        if (submit) await pressEnter(session);
        return {
          text: submit
            ? `Submitted to Cursor Agent (${model}) via ${target.title}`
            : `Drafted in Cursor composer (${model})`,
          stopReason: submit ? "submitted" : "drafted",
          modelSelect,
        };
      } finally {
        session.close();
      }
    },
  };
}
