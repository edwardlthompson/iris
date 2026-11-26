import { connectCdp, listWorkbenchTargets, pickAgentsTarget } from "./cdp.js";

export type UsageProduct = {
  id: string;
  label: string;
  name: string;
  models?: string;
  h5Left: number | null;
  d7Left: number | null;
  reset5h?: string;
  reset7d?: string;
  h5Disabled?: boolean;
};

export type UsageSnapshot = {
  mode: "left";
  source: "chip" | "stub";
  products: UsageProduct[];
};

const READ_USAGE_CHIP = `(() => {
  const btn = [...document.querySelectorAll('button,[role=button]')].find(e => {
    const t = (e.getAttribute('aria-label') || e.innerText || '').trim();
    return /^Usage\\s+\\d{1,3}%/i.test(t);
  });
  if (!btn) return null;
  const raw = (btn.getAttribute('aria-label') || btn.innerText || '').trim();
  const m = /Usage\\s+(\\d{1,3})%/i.exec(raw);
  return m ? { usedPct: Number(m[1]), label: raw } : null;
})()`;

/** Read Cursor's composer Usage chip (% used → % left). Soft-fails to null. */
export async function scrapeCursorUsageChip(
  cdpHttp = "http://127.0.0.1:9222",
): Promise<UsageSnapshot | null> {
  try {
    const targets = await listWorkbenchTargets(cdpHttp);
    const target = pickAgentsTarget(targets);
    if (!target) return null;
    const session = await connectCdp(target.ws);
    try {
      const chip = (await session.evaluate(READ_USAGE_CHIP)) as {
        usedPct: number;
        label: string;
      } | null;
      if (!chip || !Number.isFinite(chip.usedPct)) return null;
      const left = Math.max(0, Math.min(100, 100 - Math.round(chip.usedPct)));
      return {
        mode: "left",
        source: "chip",
        products: [
          {
            id: "cursor",
            program: "cursor",
            label: "Cursor",
            name: "Cursor",
            models: "From Usage chip",
            h5Left: null,
            d7Left: left,
            reset7d: "period",
            h5Disabled: true,
          },
        ],
      };
    } finally {
      session.close();
    }
  } catch {
    return null;
  }
}

export function stubUsage(pctLeft = 100): UsageSnapshot {
  return {
    mode: "left",
    source: "stub",
    products: [
      {
        id: "cursor",
        program: "cursor",
        label: "Cursor",
        name: "Cursor",
        models: "stub",
        h5Left: pctLeft,
        d7Left: pctLeft,
        reset5h: "5h",
        reset7d: "period",
        h5Disabled: false,
      },
    ],
  };
}
