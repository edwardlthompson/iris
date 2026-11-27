import type { WebSocket } from "ws";
import {
  createCdpCursorBridge,
  cdpAgentBusy,
  CursorDriver,
  focusEditorTab,
  listEditorTabs,
  processNameProbe as cursorProcessProbe,
} from "@iris/adapter-cursor";
import {
  focusAntigravityEditor,
  listAntigravityEditors,
  selectAntigravityModel,
  submitAntigravityPrompt,
} from "@iris/adapter-antigravity";
import { ClaudeSession, createCliClaudeRuntime } from "@iris/adapter-claude";
import type { PairingService } from "./pairing.js";
import { cursorCredits, listProcessNames, snapshotLegs } from "./legs.js";
import { routePrompt } from "./route-prompt.js";
import { fallbackOrder, findLadderModel } from "./model-ladder.js";
import { randomUUID } from "node:crypto";
import { requestPhoneApproval, settleApproval } from "./approvals.js";
import { deviceTokenOk, issueDeviceToken } from "./devices.js";
import { setupLeg } from "./leg-setup.js";
import { rememberTurn, withHandoff } from "./thread-handoff.js";
import { publishTurnNotice } from "./turn-notice.js";
import { readPrefs, savePrefs } from "./prefs.js";
import { lockedRepo, setLockedRepo } from "./workspace-lock.js";
import { listRepoCatalog } from "./repo-catalog.js";
import { ideWindowTitles, repoMismatches, blockingTitle } from "./ide-windows.js";
import {
  listChanges,
  listRepoFiles,
  readDiff,
  readNamedFile,
  searchRepoFiles,
} from "./workspace-file.js";
import { runPoolTurn } from "./pool-runtime.js";
import { antigravityBrainBusy } from "./sources-antigravity.js";
import { listAllHistory, loadChatView } from "./unified-chat.js";

export type ControlDeps = {
  pairing: PairingService;
  fingerprint: string;
};

type InMsg =
  | { type: "pair"; code?: string; token?: string }
  | { type: "status" }
  | { type: "chat"; id?: string }
  | { type: "history"; leg?: string }
  | { type: "editors"; leg?: string; query?: string }
  | { type: "editor_focus"; name: string; leg?: string }
  | { type: "file"; name: string }
  | { type: "changes" }
  | { type: "file_index" }
  | { type: "diff"; name: string }
  | {
      type: "prompt";
      text: string;
      model?: string;
      preset?: string;
      leg?: string;
      images?: { data: string; name?: string; type?: string }[];
    }
  | { type: "approval"; id?: string; decision: string }
  | { type: "prefs"; preset?: string; model?: string; leg?: string }
  | { type: "setup"; leg?: string }
  | { type: "repos" }
  | { type: "repo_lock"; path: string };

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

let turnsInFlight = 0;

async function pushChat(ws: WebSocket, id?: string): Promise<void> {
  const busy =
    turnsInFlight > 0 ||
    antigravityBrainBusy() ||
    (await cdpAgentBusy(9222)) ||
    (await cdpAgentBusy(9000));
  const view = loadChatView(id);
  send(ws, {
    type: "chat",
    source: view.source,
    id: view.id,
    title: view.title,
    items: view.items,
    busy,
  });
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
      if (
        msg.type === "prompt" ||
        msg.type === "chat" ||
        msg.type === "history" ||
        msg.type === "editors" ||
        msg.type === "editor_focus" ||
        msg.type === "file" ||
        msg.type === "file_index" ||
        msg.type === "changes" ||
        msg.type === "diff"
      ) {
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
      if (msg.model?.startsWith("ag:") || msg.leg === "antigravity") {
        const picked = msg.model?.startsWith("ag:")
          ? findLadderModel(msg.model, {
              cursorLeft: 100,
              groups: {},
              claudeOn: true,
              antiOn: true,
            })
          : null;
        void selectAntigravityModel({
          pickerLabel: picked?.pickerLabel || "Claude Sonnet 5.5",
          effort: picked?.effort || "medium",
        })
          .then(async () => {
            const snap = await snapshotLegs();
            broadcast({
              type: "status",
              paired: true,
              fingerprint: deps.fingerprint,
              bestLeg: snap.bestLeg,
              legs: snap.legs,
              models: snap.models,
              usage: snap.usage,
              pickedModel: snap.pickedModel,
            });
          })
          .catch(() => {});
      }
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
      const hits = await searchRepoFiles(msg.query?.trim() || "");
      send(ws, { type: "editors", tabs: hits.map((name) => ({ name, label: name, disk: true })) });
      return;
    }

    if (msg.type === "file_index") {
      const files = await listRepoFiles();
      send(ws, { type: "file_index", files, total: files.length });
      return;
    }

    if (msg.type === "changes") {
      send(ws, { type: "changes", files: await listChanges() });
      return;
    }

    if (msg.type === "diff") {
      const text = await readDiff(msg.name);
      send(
        ws,
        text != null
          ? { type: "diff", name: msg.name, text }
          : { type: "diff", name: msg.name, error: "no diff" },
      );
      return;
    }

    if (msg.type === "file") {
      const file = await readNamedFile(msg.name);
      send(
        ws,
        file
          ? { type: "file", name: msg.name, path: file.path, text: file.text }
          : { type: "file", name: msg.name, error: "not in workspace" },
      );
      return;
    }

    if (msg.type === "editor_focus") {
      const ok =
        msg.leg === "antigravity"
          ? await focusAntigravityEditor(msg.name)
          : await focusEditorTab(msg.name);
      const tabs =
        msg.leg === "antigravity" ? await listAntigravityEditors() : await listEditorTabs();
      send(ws, { type: "editors", tabs, focused: ok ? msg.name : null });
      return;
    }

    if (msg.type === "repos") {
      const lock = lockedRepo();
      send(ws, { type: "repos", lock, repos: listRepoCatalog(lock) });
      return;
    }

    if (msg.type === "repo_lock") {
      try {
        const lock = setLockedRepo(msg.path);
        send(ws, { type: "repos", lock, repos: listRepoCatalog(lock) });
      } catch (err) {
        send(ws, {
          type: "error",
          reason: "repo_lock",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (msg.type === "history") {
      try {
        const conversations = await listAllHistory();
        send(ws, { type: "history", conversations });
      } catch (err) {
        send(ws, { type: "history", conversations: [], error: String(err) });
      }
      return;
    }

    if (msg.type === "chat") {
      if (!msg.id || msg.id === "unified") activeChat.delete(ws);
      else activeChat.set(ws, msg.id);
      await pushChat(ws, activeChat.get(ws));
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
        if (String(p.id).startsWith("ag-")) groups[p.id] = p.h5Left ?? p.d7Left;
      }
      const poolLeg = snap.legs.find((l) => l.id === "pool" && l.connected);
      const poolProd = snap.usage.products.find((p) => p.id === "pool");
      const quota = {
        cursorLeft,
        groups,
        claudeOn: snap.legs.some((l) => l.id === "claude" && l.connected),
        antiOn: snap.legs.some((l) => l.id === "antigravity" && l.connected),
        poolOn: Boolean(poolLeg),
        poolLeft: poolProd?.d7Left ?? null,
        poolModel: poolLeg?.model ?? null,
        poolModels: snap.poolModels,
      };
      const routed = routePrompt({
        text: msg.text,
        preset: msg.preset,
        model: msg.model,
        fallbackModel: snap.pickedModel ?? undefined,
        quota,
      });
      const { mode } = routed;
      const prompt = withHandoff(msg.text);
      const funded = fallbackOrder(
        routed.preset === "manual" ? "max" : (routed.preset ?? "max"),
        quota,
      );
      const baseOrder = [routed.pick, ...funded.filter((m) => m.id !== routed.pick.id)];
      const order = baseOrder;
      const dead = new Set<string>();
      let lastErr = "No leg accepted the prompt";
      const lock = lockedRepo();
      const titles = await ideWindowTitles();
      const mismatches = repoMismatches(lock.name, titles);
      send(ws, { type: "repo_alert", repo: lock.name, mismatches });
      turnsInFlight += 1;
      let sent = false;
      try {
        for (const pick of order) {
          if (dead.has(pick.leg) || pick.remainingPct <= 0) continue;
          const model = pick.id;
          const leg = pick.leg;
          try {
            if (leg === "pool") throw new Error("Venice and LiteLLM are disabled");
            if (leg === "claude") {
              const session = new ClaudeSession({
                runtime: createCliClaudeRuntime(),
                model: pick.id.slice(pick.id.indexOf(":") + 1),
              });
              const out = await session.run(prompt);
              rememberTurn("claude", msg.text, out.texts[0] || out.stopReason, {
                model: pick.label,
                effort: pick.effort || pick.level,
              });
              send(ws, {
                type: "prompt_result",
                leg: "claude",
                model: pick.label,
                effort: pick.effort,
                stopReason: out.stopReason,
                detail: out.texts.join("\n").slice(0, 4000) || "Submitted to Claude Code (cloud)",
              });
              publishTurnNotice("Iris · Claude Code", out.texts[0]?.slice(0, 180) || "Reply ready");
              void pushChat(ws, activeChat.get(ws));
              setTimeout(() => void pushChat(ws, activeChat.get(ws)), 1500);
              sent = true;
              break;
            }
            if (leg === "pool") {
              const out = await runPoolTurn(prompt, model, {
                images: msg.images,
                onApproval: (summary) =>
                  new Promise((resolve) => {
                    const id = randomUUID();
                    void requestPhoneApproval(id, () => {
                      send(ws, { type: "tool_approval", id, summary });
                    }).then((decision) => resolve(/allow|accept|yes/i.test(decision)));
                  }),
              });
              rememberTurn("pool", msg.text, out.text);
              send(ws, {
                type: "prompt_result",
                leg: "pool",
                model: out.model,
                effort: pick.effort,
                text: out.text,
                stopReason: out.stopReason,
                detail: out.text.slice(0, 4000),
              });
              publishTurnNotice("Iris · Pool", out.text.slice(0, 180) || "Reply ready");
              void pushChat(ws, activeChat.get(ws));
              sent = true;
              break;
            }
            if (leg === "antigravity") {
              const antiBlock = blockingTitle(titles.antigravity, lock.name);
              if (antiBlock) {
                throw new Error(
                  `Antigravity is open on "${antiBlock}", not ${lock.name}. Prompt was not sent.`,
                );
              }
              const out = await submitAntigravityPrompt(prompt, {
                pickerLabel: pick.pickerLabel || "Claude Sonnet 5.5",
                effort: pick.effort || "medium",
                expectRepo: lock.name,
              });
              rememberTurn("antigravity", msg.text, out.stopReason, {
                model: pick.label,
                effort: pick.effort || pick.level,
              });
              send(ws, {
                type: "prompt_result",
                leg: "antigravity",
                model,
                pickedModel: model,
                modelSelect: out.modelSelect ?? null,
                stopReason: out.stopReason,
                detail: "Submitted to Antigravity on CDP :9000",
                effort: pick.effort,
              });
              publishTurnNotice("Iris · Antigravity", "Reply ready");
              void pushChat(ws, activeChat.get(ws));
              setTimeout(() => void pushChat(ws, activeChat.get(ws)), 1500);
              setTimeout(() => void pushChat(ws, activeChat.get(ws)), 4500);
              sent = true;
              break;
            }
            const cursorBlock = blockingTitle(titles.cursor, lock.name);
            if (cursorBlock) {
              throw new Error(
                `Cursor is open on "${cursorBlock}", not ${lock.name}. Prompt was not sent.`,
              );
            }
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
                setTimeout(
                  () => reject(new Error("Cursor did not accept the prompt within 20s")),
                  20_000,
                );
              }),
            ]);
            rememberTurn("cursor", msg.text, out.text || out.stopReason, {
              model: pick.label,
              effort: pick.effort || pick.level,
            });
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
            sent = true;
            break;
          } catch (err) {
            dead.add(leg);
            lastErr = err instanceof Error ? err.message : String(err);
          }
        }
        if (!sent) {
          send(ws, { type: "error", reason: "no_available_leg", detail: lastErr, legs: snap.legs });
        }
      } finally {
        turnsInFlight = Math.max(0, turnsInFlight - 1);
      }
    }
  };
}

export { snapshotLegs } from "./legs.js";
