import type { WebSocket } from "ws";
import {
  createCdpCursorBridge,
  cdpAgentBusy,
  CursorDriver,
  focusEditorTab,
  listConversations,
  listEditorTabs,
  loadChatById,
  loadLatestChat,
  processNameProbe as cursorProcessProbe,
} from "@iris/adapter-cursor";
import {
  focusAntigravityEditor,
  listAntigravityEditors,
  listAntigravityHistory,
  submitAntigravityPrompt,
} from "@iris/adapter-antigravity";
import { ClaudeSession, createCliClaudeRuntime } from "@iris/adapter-claude";
import type { PairingService } from "./pairing.js";
import { cursorCredits, listProcessNames, snapshotLegs } from "./legs.js";
import { routePrompt } from "./route-prompt.js";
import { settleApproval } from "./approvals.js";
import { deviceTokenOk, issueDeviceToken } from "./devices.js";
import { setupLeg } from "./leg-setup.js";
import { rememberTurn } from "./thread-handoff.js";
import { publishTurnNotice } from "./turn-notice.js";
import { readPrefs, savePrefs } from "./prefs.js";
import { listChanges, readDiff, readNamedFile } from "./workspace-file.js";

export type ControlDeps = {
  pairing: PairingService;
  fingerprint: string;
};

type InMsg =
  | { type: "pair"; code?: string; token?: string }
  | { type: "status" }
  | { type: "chat"; id?: string }
  | { type: "history"; leg?: string }
  | { type: "editors"; leg?: string }
  | { type: "editor_focus"; name: string; leg?: string }
  | { type: "file"; name: string }
  | { type: "changes" }
  | { type: "diff"; name: string }
  | { type: "prompt"; text: string; model?: string; preset?: string; leg?: string; images?: { data: string; name?: string; type?: string }[] }
  | { type: "approval"; id?: string; decision: string }
  | { type: "prefs"; preset?: string; model?: string; leg?: string }
  | { type: "setup"; leg?: string };

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

let turnsInFlight = 0;

async function pushChat(ws: WebSocket, id?: string): Promise<void> {
  const busy =
    turnsInFlight > 0 || (await cdpAgentBusy(9222)) || (await cdpAgentBusy(9000));
  if (id) {
    const loaded = loadChatById(id);
    send(ws, {
      type: "chat",
      source: loaded.file ? "transcript" : "empty",
      id,
      title: loaded.title,
      items: loaded.items,
      busy,
    });
    return;
  }
  const { file, items } = loadLatestChat("Iris");
  send(ws, { type: "chat", source: file ? "transcript" : "empty", items, busy });
}

export function createControlHandler(deps: ControlDeps) {
  const paired = new WeakMap<WebSocket, string>();
  const sockets = new Set<WebSocket>();
  const activeChat = new WeakMap<WebSocket, string | undefined>();
  const broadcast = (obj: unknown) => {
    for (const sock of sockets) send(sock, obj);
  };

  return async (ws: WebSocket, text: string) => {
    let msg: InMsg;
    try {
      msg = JSON.parse(text) as InMsg;
    } catch {
      send(ws, { type: "error", reason: "bad_json" });
      return;
    }

    if (msg.type === "approval") {
      const ok = msg.id ? settleApproval(msg.id, msg.decision) : false;
      send(ws, { type: "approval_result", id: msg.id ?? null, ok, decision: msg.decision });
      return;
    }

    if (msg.type === "pair") {
      const byToken = msg.token ? await deviceTokenOk(msg.token) : false;
      const result = byToken
        ? deps.pairing.pair(deps.fingerprint)
        : deps.pairing.pair(msg.code ?? "");
      if (!result.ok) {
        send(ws, { type: "error", reason: result.reason });
        return;
      }
      paired.set(ws, result.sessionId);
      sockets.add(ws);
      const token = byToken && msg.token ? msg.token : await issueDeviceToken();
      const snap = await snapshotLegs();
      const prefs = await readPrefs();
      send(ws, {
        type: "paired",
        sessionId: result.sessionId,
        fingerprint: deps.fingerprint,
        token,
        prefs,
        bestLeg: snap.bestLeg,
        legs: snap.legs,
        models: snap.models,
        usage: snap.usage,
        pickedModel: snap.pickedModel,
      });
      pushChat(ws);
      return;
    }

    if (!paired.has(ws) && msg.type !== "status") {
      if (msg.type === "prompt" || msg.type === "chat" || msg.type === "history" || msg.type === "editors" || msg.type === "editor_focus" || msg.type === "file" || msg.type === "changes" || msg.type === "diff") {
        send(ws, { type: "error", reason: "not_paired" });
        return;
      }
    }

    if (msg.type === "setup") {
      const detail = setupLeg(msg.leg || "");
      send(ws, { type: "setup_result", leg: msg.leg ?? null, detail });
      return;
    }

    if (msg.type === "prefs") {
      const prefs = await savePrefs({ preset: msg.preset, model: msg.model, leg: msg.leg });
      broadcast({ type: "prefs", ...prefs });
      return;
    }

    if (msg.type === "status") {
      const snap = await snapshotLegs();
      send(ws, {
        type: "status",
        paired: paired.has(ws),
        fingerprint: deps.fingerprint,
        bestLeg: snap.bestLeg,
        legs: snap.legs,
        models: snap.models,
        usage: snap.usage,
        pickedModel: snap.pickedModel,
      });
      return;
    }

    if (msg.type === "editors") {
      const tabs = msg.leg === "antigravity" ? await listAntigravityEditors() : await listEditorTabs();
      send(ws, { type: "editors", tabs });
      return;
    }

    if (msg.type === "changes") {
      send(ws, { type: "changes", files: await listChanges() });
      return;
    }

    if (msg.type === "diff") {
      const text = await readDiff(msg.name);
      send(ws, text != null
        ? { type: "diff", name: msg.name, text }
        : { type: "diff", name: msg.name, error: "no diff" });
      return;
    }

    if (msg.type === "file") {
      const file = await readNamedFile(msg.name);
      send(ws, file
        ? { type: "file", name: msg.name, path: file.path, text: file.text }
        : { type: "file", name: msg.name, error: "not in workspace" });
      return;
    }

    if (msg.type === "editor_focus") {
      const ok = msg.leg === "antigravity"
        ? await focusAntigravityEditor(msg.name)
        : await focusEditorTab(msg.name);
      const tabs = msg.leg === "antigravity" ? await listAntigravityEditors() : await listEditorTabs();
      send(ws, { type: "editors", tabs, focused: ok ? msg.name : null });
      return;
    }

    if (msg.type === "history") {
      try {
        const cursorChats = listConversations(24).map((c) => ({
          id: c.id,
          title: c.title,
          project: c.project || "Cursor",
          mtimeMs: c.mtimeMs,
        }));
        const antiChats = (await listAntigravityHistory().catch(() => [])).map((c) => ({
          id: `ag:${c.id}`,
          title: c.title,
          project: "Antigravity",
          mtimeMs: c.mtimeMs || Date.now(),
        }));
        const conversations = [...antiChats, ...cursorChats];
        send(ws, { type: "history", conversations });
      } catch (err) {
        send(ws, { type: "history", conversations: [], error: String(err) });
      }
      return;
    }

    if (msg.type === "chat") {
      if (msg.id?.startsWith("ag:")) {
        send(ws, {
          type: "chat",
          source: "antigravity",
          id: msg.id,
          title: "Antigravity",
          items: [{ role: "assistant", text: "This chat lives in Antigravity. Select the Antigravity leg to continue it there." }],
        });
        return;
      }
      if (msg.id) activeChat.set(ws, msg.id);
      pushChat(ws, msg.id ?? activeChat.get(ws));
      return;
    }

    if (msg.type === "prompt") {
      const snap = await snapshotLegs();
      if (!snap.bestLeg) {
        send(ws, {
          type: "error",
          reason: "no_available_leg",
          detail: "No funded/running leg. Open Cursor or add credits.",
          legs: snap.legs,
        });
        return;
      }

      const cursorLeft = snap.usage.products.find((p) => p.id === "cursor")?.d7Left ?? null;
      const groups: Record<string, number | null> = {};
      for (const p of snap.usage.products) {
        if (p.id.startsWith("ag-")) groups[p.id] = p.h5Left ?? p.d7Left;
      }
      const routed = routePrompt({
        text: msg.text,
        preset: msg.preset,
        model: msg.model,
        fallbackModel: snap.pickedModel ?? undefined,
        quota: {
          cursorLeft,
          groups,
          claudeOn: snap.legs.some((l) => l.id === "claude" && l.connected),
          antiOn: snap.legs.some((l) => l.id === "antigravity" && l.connected),
        },
      });
      const { pick, mode } = routed;
      const model = pick.id;
      const leg = pick.leg;
      const prompt = msg.text;
      turnsInFlight += 1;
      try {
      if (leg === "claude") {
        try {
          const session = new ClaudeSession({ runtime: createCliClaudeRuntime() });
          const out = await session.run(prompt);
          rememberTurn("claude", msg.text, out.texts[0] || out.stopReason);
          send(ws, {
            type: "prompt_result",
            leg: "claude",
            model: "claude.ai",
            stopReason: out.stopReason,
            detail: out.texts.join("\n").slice(0, 4000) || "Submitted to Claude Code (cloud)",
          });
          publishTurnNotice("Iris · Claude Code", out.texts[0]?.slice(0, 180) || "Reply ready");
        } catch (err) {
          send(ws, {
            type: "error",
            reason: "claude_disabled",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }
      if (leg === "antigravity") {
        try {
          const out = await submitAntigravityPrompt(prompt);
          rememberTurn("antigravity", msg.text, out.stopReason);
          send(ws, {
            type: "prompt_result",
            leg: "antigravity",
            model,
            stopReason: out.stopReason,
            detail: "Submitted to Antigravity on CDP :9000",
          });
          publishTurnNotice("Iris · Antigravity", "Reply ready");
        } catch (err) {
          send(ws, {
            type: "error",
            reason: "antigravity_disabled",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }
      try {
        const driver = new CursorDriver(
          cursorProcessProbe(listProcessNames),
          cursorCredits(),
          createCdpCursorBridge(),
        );
        const out = await Promise.race([
          driver.run({
            prompt,
            model,
            effort: pick.effort,
            pickerLabel: pick.pickerLabel,
            images: msg.images,
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Cursor did not accept the prompt within 20s")), 20_000);
          }),
        ]);
        rememberTurn("cursor", msg.text, out.stopReason);
        send(ws, {
          type: "prompt_result",
          leg: "cursor",
          model: out.model ?? model,
          effort: pick.effort,
          preset: routed.preset,
          mode,
          stage1: routed.stage1
            ? {
                kind: routed.stage1.kind,
                preset: routed.stage1.kind === "preset" ? routed.stage1.preset : null,
                score: routed.stage1.score,
              }
            : null,
          text: out.text,
          stopReason: out.stopReason,
          modelSelect: out.modelSelect ?? null,
          pickedModel: out.model ?? model,
          usage: snap.usage,
        });
        publishTurnNotice("Iris · Cursor", (out.text || "Reply ready").slice(0, 180));
        const chatId = activeChat.get(ws);
        pushChat(ws, chatId);
        setTimeout(() => pushChat(ws, chatId), 2000);
      } catch (e) {
        send(ws, {
          type: "error",
          reason: "cursor_bridge_failed",
          detail: e instanceof Error ? e.message : String(e),
          legs: snap.legs,
        });
      }
      } finally {
        turnsInFlight = Math.max(0, turnsInFlight - 1);
      }
    }
  };
}

export { snapshotLegs } from "./legs.js";
