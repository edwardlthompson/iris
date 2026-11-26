import { createHash } from "node:crypto";

export const SOURCE_URL = "https://llmleaderboard.com/benchmarks/cursorbench";
export const TRACK = "4.0";
export const STALE_DAYS = 30;
export const UNVERIFIED_DAYS = 90;

/** @typedef {{ model: string, effort: string, score: number, usd_per_task: number|null, tok_per_task: number|null, steps: number|null }} BenchRow */

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function ageDays(fetchedAt, now = new Date()) {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / (86_400_000);
}

export function stalenessBadge(fetchedAt, now = new Date()) {
  const days = ageDays(fetchedAt, now);
  if (days >= UNVERIFIED_DAYS) return "presets unverified";
  if (days >= STALE_DAYS) return "est. stale"; // includes 31-day done-when
  return null;
}

/** Minimal HTML table parser for CursorBench-shaped rows. */
export function parseCursorBenchHtml(html) {
  /** @type {BenchRow[]} */
  const rows = [];
  const re =
    /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gis;
  let m;
  while ((m = re.exec(html))) {
    const model = strip(m[1]);
    const effort = strip(m[2]);
    if (/^model$/i.test(model)) continue;
    const score = parsePct(m[3]);
    const usd = parseMoney(m[4]);
    const tok = parseNum(m[5]);
    const steps = parseNum(m[6]);
    if (!model || score === null) continue;
    rows.push({
      model,
      effort,
      score,
      usd_per_task: usd,
      tok_per_task: tok,
      steps,
    });
  }
  return rows;
}

/**
 * @param {BenchRow[]} rows
 * @param {{ previousCount?: number, track?: string }} opts
 */
export function guardrails(rows, opts = {}) {
  const failures = [];
  const track = opts.track ?? TRACK;
  if (track !== "4.0") failures.push(`track ${track} quarantined`);
  if (rows.length < 20) failures.push(`under 20 rows (${rows.length})`);
  if (opts.previousCount != null && opts.previousCount > 0) {
    const drop = (opts.previousCount - rows.length) / opts.previousCount;
    if (drop > 0.3) failures.push(`>30% drop (${opts.previousCount}→${rows.length})`);
  }
  for (const r of rows) {
    if (r.score < 5 || r.score > 85) failures.push(`score out of band: ${r.model} ${r.score}`);
    if (r.usd_per_task === 0 || (r.usd_per_task != null && r.usd_per_task > 100)) {
      failures.push(`usd_per_task bad: ${r.model}`);
    }
  }
  return failures;
}

/**
 * @param {object} p
 * @param {string} p.source
 * @param {string} p.fetched_at
 * @param {string} p.body_sha256
 * @param {number} p.row_count
 * @param {string} [p.track]
 * @param {string|null} [p.badge]
 * @param {BenchRow[]} rows
 */
export function formatBenchmarksMd(p, rows) {
  const provenance = {
    v: 1,
    source: p.source,
    source_kind: "html",
    fetched_at: p.fetched_at,
    body_sha256: p.body_sha256,
    row_count: p.row_count,
    track: p.track ?? TRACK,
    confirmed_by: null,
    confirmed_at: null,
  };
  const badge = p.badge ? `\n> **Staleness:** ${p.badge}\n` : "\n";
  const lines = [
    "# BENCHMARKS",
    "",
    "<!-- provenance",
    JSON.stringify(provenance, null, 2),
    "-->",
    badge,
    "Reference figures labelled `ref. CursorBench`. Calibration overwrites estimates after ~20 runs.",
    "",
    "| Model | Effort | Score | $/task | Tok/task | Steps |",
    "|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.model} | ${r.effort} | ${r.score.toFixed(1)}% | ${fmt(r.usd_per_task)} | ${fmt(r.tok_per_task)} | ${fmt(r.steps)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function extractProvenance(md) {
  const m = md.match(/<!-- provenance\n([\s\S]*?)\n-->/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function countRowsInMd(md) {
  return md.split("\n").filter((l) => /^\| [^|]+ \|/.test(l) && !/^\| Model \|/.test(l) && !/^\|---/.test(l))
    .length;
}

function strip(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function parsePct(s) {
  const t = strip(s).replace(/%/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseMoney(s) {
  const t = strip(s);
  if (/^n\/p$/i.test(t)) return null;
  const n = Number(t.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseNum(s) {
  const t = strip(s).replace(/,/g, "");
  if (/^n\/p$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  if (v == null) return "n/p";
  return String(v);
}
