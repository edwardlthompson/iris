import type { CostChipSnapshot } from "./cost-chip.js";
import { formatChipLine } from "./cost-chip.js";
import { t } from "./i18n.js";

/** Render chip DOM props — no raw hex; budget tone is a semantic class token. */
export type ChipViewModel = {
  line: string;
  ariaLabel: string;
  budgetClass: `budget-${CostChipSnapshot["budgetTone"]}`;
  topologyLabel: string;
  refLabel: string;
  pinLabel: string;
  primaryLabel: string;
  mode: CostChipSnapshot["mode"];
};

export function toChipView(s: CostChipSnapshot | null): ChipViewModel | null {
  if (!s) {
    return {
      line: t("chip.empty"),
      ariaLabel: t("chip.aria"),
      budgetClass: "budget-ok",
      topologyLabel: "",
      refLabel: t("chip.ref"),
      pinLabel: t("chip.pin"),
      primaryLabel: t("chip.primary"),
      mode: "suggest",
    };
  }
  return {
    line: formatChipLine(s),
    ariaLabel: `${t("chip.aria")}: ${formatChipLine(s)}`,
    budgetClass: `budget-${s.budgetTone}`,
    topologyLabel: s.topology === "pool" ? t("chip.topology.pool") : t("chip.topology.direct"),
    refLabel: s.refLabel,
    pinLabel: s.pinned ? t("chip.unpin") : t("chip.pin"),
    primaryLabel: t("chip.primary"),
    mode: s.mode,
  };
}
