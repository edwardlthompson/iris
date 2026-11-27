import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  processNameProbe,
  probeCursorLeg,
  candidacyFlags,
  grokCreditInventory,
  pickForPreset,
  scrapeCursorUsageChip,
  stubUsage,
  type CreditProbe,
} from "@iris/adapter-cursor";
import {
  claudeCliStatus,
  claudeOauthUsage,
  hasClaudeCredentials,
  type ClaudeUsageSnapshot,
} from "@iris/adapter-claude";
import { readAntigravityActiveModel, scrapeAntigravityUsage } from "@iris/adapter-antigravity";
import { ladderInventory } from "./model-ladder.js";
import { readActionsMinutes } from "./actions-minutes.js";
import { pickBestAvailable } from "@iris/router";

const execFileAsync = promisify(execFile);

/** All product legs — connected ones get green dots; others open Add wizard. */
export const LEG_CATALOG = [
  {
    id: "cursor",
    label: "Cursor",
    setup: "Open Cursor with --remote-debugging-port=9222 (start-cursor.ps1).",
  },
  {
    id: "claude",
    label: "Claude Code",
    setup:
      "Install the Claude Code CLI and sign in with your claude.ai plan. Free plan uses cloud models only.",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    setup: "Install Antigravity IDE; Iris adapter probes when running.",
  },
  { id: "codex", label: "Codex", setup: "Configure OpenAI Codex credentials on the host." },
] as const;

export async function listProcessNames(): Promise<string[]> {
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

export function cursorCredits(): CreditProbe {
  // Equal ranks so status.model stays the balanced default, not xhigh by score.
  const models = grokCreditInventory(1).map((m) => ({
    id: m.id,
    remainingPct: m.remainingPct,
    rank: 1,
  }));
  const best = pickForPreset("balanced");
  return {
    snapshot: () => ({
      remainingPct: 1,
      bestModel: best.id,
      models,
    }),
  };
}

async function antigravityReachable(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:9000/json/version");
    return res.ok;
  } catch {
    return false;
  }
}

let usageCache: {
  at: number;
  live: Awaited<ReturnType<typeof scrapeCursorUsageChip>>;
  anti: Awaited<ReturnType<typeof scrapeAntigravityUsage>>;
} | null = null;
let lastClaudeUse: ClaudeUsageSnapshot | null = null;

export async function snapshotLegs() {
  const ide = processNameProbe(listProcessNames);
  const antiUp = await antigravityReachable();
  const antiModel = antiUp ? await readAntigravityActiveModel().catch(() => null) : null;
  const claude = await claudeCliStatus().catch(() => ({
    installed: hasClaudeCredentials(),
    loggedIn: hasClaudeCredentials(),
  }));
  const claudeUse = await claudeOauthUsage().catch(() => null);
  if (claudeUse) lastClaudeUse = claudeUse;
  const shown = claudeUse ?? lastClaudeUse;
  const claudeAuthed = claude.loggedIn || hasClaudeCredentials() || Boolean(shown);
  const cursor = await probeCursorLeg(ide, cursorCredits());
  const flags = candidacyFlags(cursor);
  const credits = cursorCredits().snapshot();
  const legs = LEG_CATALOG.map((meta) => {
    if (meta.id === "cursor") {
      return {
        id: meta.id,
        label: meta.label,
        setup: meta.setup,
        hasCredentials: true,
        quotaOk: flags.quotaOk,
        available: flags.available,
        disabledReason: flags.disabledReason,
        model: flags.model ?? null,
        rank: 40,
        enabled: cursor.enabled,
        connected: cursor.enabled,
      };
    }
    if (meta.id === "claude") {
      const on = (claude.installed || claudeAuthed) && claudeAuthed;
      return {
        id: meta.id,
        label: meta.label,
        setup: meta.setup,
        hasCredentials: claudeAuthed,
        quotaOk: on,
        available: on,
        disabledReason: on ? null : claude.installed ? "login_required" : "not_configured",
        model: on ? "claude.ai" : null,
        rank: on ? 25 : 0,
        enabled: on,
        connected: on,
      };
    }
    if (meta.id === "antigravity") {
      return {
        id: meta.id,
        label: meta.label,
        setup: meta.setup,
        hasCredentials: antiUp,
        quotaOk: antiUp,
        available: antiUp,
        disabledReason: antiUp ? null : "ide_closed",
        model: antiUp ? antiModel || "Claude Sonnet 5.5" : null,
        rank: antiUp ? 30 : 0,
        enabled: antiUp,
        connected: antiUp,
      };
    }
    return {
      id: meta.id,
      label: meta.label,
      setup: meta.setup,
      hasCredentials: false,
      quotaOk: false,
      available: false,
      disabledReason: "not_configured",
      model: null,
      rank: 0,
      enabled: false,
      connected: false,
    };
  });
  const ranked = legs.filter((l) => l.enabled);
  const best = pickBestAvailable(ranked);
  const now = Date.now();
  if (!usageCache || now - usageCache.at > 30_000) {
    const live = await scrapeCursorUsageChip().catch(() => null);
    const antiProducts = antiUp ? await scrapeAntigravityUsage().catch(() => []) : [];
    usageCache = { at: now, live, anti: antiProducts };
  }
  const live = usageCache.live;
  const base = live ?? stubUsage(0);
  const usage = { ...base, products: base.products.map((p) => ({ ...p })) };
  const antiProducts = usageCache.anti;
  for (const product of antiProducts) usage.products.push(product);
  if (claudeAuthed || shown) {
    usage.products.push({
      id: "claude",
      program: "claude",
      label: "Claude Code",
      name: "Claude Code",
      models: shown
        ? `Session ${shown.sessionLeft}% left · week ${shown.weekLeft}% left`
        : "Pro · sign in with the Claude Code CLI to load remaining tokens",
      h5Left: shown?.sessionLeft ?? null,
      d7Left: shown?.weekLeft ?? null,
      reset5h: shown?.reset5h ?? null,
      reset7d: shown?.reset7d ?? null,
      h5Disabled: !shown,
    });
  }
  const actions = await readActionsMinutes();
  if (actions) {
    const left = Math.max(0, actions.included - actions.used);
    usage.products.push({
      id: "actions",
      program: "actions",
      label: "GitHub Actions",
      name: "GitHub Actions",
      models: `${left} of ${actions.included} minutes left`,
      h5Left: null,
      d7Left: actions.leftPct,
      reset7d: "included",
      h5Disabled: true,
    });
  }
  usage.source = usage.products.length > 1 ? "chip" : usage.source;
  const cursorLeft = usage.products.find((p) => p.id === "cursor")?.d7Left ?? null;
  const groups: Record<string, number | null> = {};
  for (const p of usage.products) {
    if (String(p.id).startsWith("ag-")) groups[p.id] = p.h5Left ?? p.d7Left;
  }
  const inventory = ladderInventory({
    cursorLeft,
    groups,
    claudeOn: claude.loggedIn || Boolean(claudeUse),
    antiOn: antiUp,
    poolOn: false,
  });
  if (!live) {
    usage.products[0]!.models = "Usage chip unavailable — open Cursor Agents";
    usage.products[0]!.h5Left = null;
    usage.products[0]!.d7Left = null;
  }
  return {
    legs,
    bestLeg: best,
    cursor,
    models: inventory,
    poolModels: [],
    usage,
    pickedModel: flags.model ?? credits.bestModel ?? pickForPreset("balanced").id,
  };
}
