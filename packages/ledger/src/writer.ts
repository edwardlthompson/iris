import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { LedgerRowSchema, type LedgerRow } from "@iris/protocol";
import { CalibrationTable } from "./calibration.js";

export type SessionActuals = {
  realUsd: number;
  realTok: number;
  outcome: LedgerRow["outcome"];
  escalations?: number;
  reworkCount?: number;
};

export type DraftRow = Omit<
  LedgerRow,
  "real_usd" | "real_tok" | "outcome" | "escalations" | "rework_count"
> & {
  escalations?: number;
  rework_count?: number;
};

/** Append-only ledger with calibration; actuals override reference estimates per leg. */
export class LedgerWriter {
  private readonly filePath: string;
  private readonly calibration: CalibrationTable;
  private buffer: LedgerRow[] = [];

  constructor(opts: { dir: string; fileName?: string; calibration?: CalibrationTable }) {
    this.filePath = path.join(opts.dir, opts.fileName ?? "ledger.ndjson");
    this.calibration = opts.calibration ?? new CalibrationTable();
  }

  get table(): CalibrationTable {
    return this.calibration;
  }

  draftFromEstimate(partial: DraftRow): DraftRow {
    const est = this.calibration.estimateFor(partial.vendor, partial.model);
    return {
      ...partial,
      est_usd: partial.est_usd || est.estUsd,
      est_tok: partial.est_tok || est.estTok,
    };
  }

  async record(draft: DraftRow, actuals: SessionActuals): Promise<LedgerRow> {
    const row = LedgerRowSchema.parse({
      ...draft,
      real_usd: actuals.realUsd,
      real_tok: actuals.realTok,
      outcome: actuals.outcome,
      escalations: actuals.escalations ?? draft.escalations ?? 0,
      rework_count: actuals.reworkCount ?? draft.rework_count ?? 0,
    });
    if (!row.shadow) {
      this.calibration.recordActual(row.vendor, row.model, actuals.realUsd, actuals.realTok);
    }
    this.buffer.push(row);
    await this.flush();
    return row;
  }

  async flush(): Promise<void> {
    if (!this.buffer.length) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const lines = this.buffer.map((r) => JSON.stringify(r)).join("\n") + "\n";
    this.buffer = [];
    let prior = "";
    try {
      prior = await readFile(this.filePath, "utf8");
    } catch {
      /* new file */
    }
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, prior + lines, "utf8");
    await rename(tmp, this.filePath);
  }

  async readAll(): Promise<LedgerRow[]> {
    await this.flush();
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch {
      return [];
    }
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => LedgerRowSchema.parse(JSON.parse(l)));
  }
}
