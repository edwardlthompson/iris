/** Composer cost chip. Figures match the Grok 4.7 CursorBench ladder in @iris/remote's chip shape. */

const USD = { low: 1.58, medium: 3.49, high: 4.69, xhigh: 6.01 };
const PRESET_EFFORT = { savings: "low", balanced: "medium", performance: "high", max: "xhigh" };

export function costChipSnapshot(preset, modelId) {
  if (preset === "auto" && !String(modelId || "").includes(":")) {
    return { text: "Auto · model follows the task", tone: "ok", estimateUsd: 0, effort: "auto" };
  }
  const effort =
    preset === "manual" || preset === "auto"
      ? String(modelId || "").split(":")[1] || "medium"
      : PRESET_EFFORT[preset] || "medium";
  const estimateUsd = USD[effort] ?? USD.medium;
  return {
    text: `Cursor · grok-4.7 · ${effort} · ~$${estimateUsd.toFixed(2)}`,
    tone: estimateUsd >= 6 ? "warn" : "ok",
    estimateUsd,
    effort,
  };
}

export function renderCostChip(el, preset, modelId) {
  if (!el) return;
  const snap = costChipSnapshot(preset, modelId);
  el.textContent = snap.text;
  el.classList.toggle("warn", snap.tone === "warn");
  el.classList.toggle("ok", snap.tone === "ok");
  el.title = "Estimate before send, labelled from the CursorBench Grok ladder";
}
