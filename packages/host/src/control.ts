import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { WebSocket } from "ws";
import {
  processNameProbe,
  probeCursorLeg,
  candidacyFlags,
  type CreditProbe,
} from "@iris/adapter-cursor";
import { pickBestAvailable } from "@iris/router";
import type { PairingService } from "./pairing.js";

const execFileAsync = promisify(execFile);

export type ControlDeps = {
  pairing: PairingService;
  fingerprint: string;
};

type PairMsg = { type: "pair"; code: string };
type StatusMsg = { type: "status" };
type PromptMsg = { type: "prompt"; text: string };
type InMsg = PairMsg | StatusMsg | PromptMsg;

function send(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

async function listProcessNames(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("tasklist", ["/FO", "CSV", "/NH"], {
      windowsHide: true,
      encoding: "utf8",
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => {
        const m = line.match(/^"([^"]+)"/);
        return m?.[1] ?? "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Dev credit probe — treat Cursor as funded when the IDE is running. */
function cursorCredits(): CreditProbe {
  return {
    snapshot: () => ({
      remainingPct: 1,
      bestModel: "composer",
      models: [
        { id: "opus", remainingPct: 0, rank: 100 },
        { id: "sonnet", remainingPct: 0, rank: 60 },
        { id: "composer", remainingPct: 1, rank: 40 },
      ],
    }),
  };
}

export async function snapshotLegs() {
  const ide = processNameProbe(listProcessNames);
  const cursor = await probeCursorLeg(ide, cursorCredits());
  const flags = candidacyFlags(cursor);
  const legs = [
    {
      id: "cursor",
      hasCredentials: true,
      quotaOk: flags.quotaOk,
      available: flags.available,
      disabledReason: flags.disabledReason,
      model: flags.model ?? null,
      rank: 40,
      enabled: cursor.enabled,
    },
  ];
  const best = pickBestAvailable(legs);
  return { legs, bestLeg: best, cursor };
}

export function createControlHandler(deps: ControlDeps) {
  const paired = new WeakMap<WebSocket, string>();

  return async (ws: WebSocket, text: string) => {
    let msg: InMsg;
    try {
      msg = JSON.parse(text) as InMsg;
    } catch {
      send(ws, { type: "error", reason: "bad_json" });
      return;
    }

    if (msg.type === "pair") {
      const result = deps.pairing.pair(msg.code);
      if (!result.ok) {
        send(ws, { type: "error", reason: result.reason });
        return;
      }
      paired.set(ws, result.sessionId);
      const snap = await snapshotLegs();
      send(ws, {
        type: "paired",
        sessionId: result.sessionId,
        fingerprint: deps.fingerprint,
        bestLeg: snap.bestLeg,
        legs: snap.legs,
      });
      return;
    }

    if (!paired.has(ws) && msg.type !== "status") {
      // Allow status before pair for diagnostics; prompts require pair.
      if (msg.type === "prompt") {
        send(ws, { type: "error", reason: "not_paired" });
        return;
      }
    }

    if (msg.type === "status") {
      const snap = await snapshotLegs();
      send(ws, {
        type: "status",
        paired: paired.has(ws),
        fingerprint: deps.fingerprint,
        bestLeg: snap.bestLeg,
        legs: snap.legs,
      });
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
      const model = snap.legs.find((l) => l.id === snap.bestLeg)?.model ?? snap.bestLeg;
      // Until the IDE bridge is wired, acknowledge routing choice only.
      send(ws, {
        type: "prompt_result",
        leg: snap.bestLeg,
        model,
        text: `[iris] routed to ${snap.bestLeg}/${model} (bridge pending): ${msg.text.slice(0, 200)}`,
        stopReason: "bridge_pending",
      });
    }
  };
}
