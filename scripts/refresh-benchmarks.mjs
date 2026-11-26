#!/usr/bin/env node
/**
 * Appendix D — refresh CursorBench into docs/BENCHMARKS.md.
 * Exit 0 + no write when body hash unchanged.
 * Guardrail failure → write needs-review marker (caller opens PR).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOURCE_URL,
  TRACK,
  sha256,
  parseCursorBenchHtml,
  guardrails,
  formatBenchmarksMd,
  extractProvenance,
  countRowsInMd,
  stalenessBadge,
} from "./lib/refresh-benchmarks-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "BENCHMARKS.md");
const REVIEW = path.join(ROOT, "docs", "BENCHMARKS.needs-review.md");

export async function refreshBenchmarks(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const outPath = opts.outPath ?? OUT;
  const reviewPath = opts.reviewPath ?? REVIEW;
  const now = opts.now ?? new Date();
  const html =
    opts.html ??
    (await fetchHtml(fetchImpl, opts.url ?? SOURCE_URL, opts.timeoutMs ?? 15_000));

  const bodyHash = sha256(html);
  let previous = "";
  try {
    previous = await readFile(outPath, "utf8");
  } catch {
    /* first run */
  }
  const prevProv = extractProvenance(previous);
  if (prevProv?.body_sha256 === bodyHash) {
    return { status: "unchanged", hash: bodyHash };
  }

  const rows = parseCursorBenchHtml(html);
  const prevCount = prevProv?.row_count ?? countRowsInMd(previous);
  const failures = guardrails(rows, { previousCount: prevCount, track: TRACK });
  const fetched_at = now.toISOString();
  const badge = stalenessBadge(fetched_at, now);
  const md = formatBenchmarksMd(
    {
      source: SOURCE_URL,
      fetched_at,
      body_sha256: bodyHash,
      row_count: rows.length,
      track: TRACK,
      badge,
    },
    rows,
  );

  if (failures.length) {
    await mkdir(path.dirname(reviewPath), { recursive: true });
    await writeFile(
      reviewPath,
      `# BENCHMARKS needs review\n\n${failures.map((f) => `- ${f}`).join("\n")}\n\n${md}`,
      "utf8",
    );
    return { status: "needs_review", failures, hash: bodyHash, rows: rows.length };
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, md, "utf8");
  return { status: "updated", hash: bodyHash, rows: rows.length };
}

async function fetchHtml(fetchImpl, url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "iris-benchmark-refresh/0.0.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  refreshBenchmarks()
    .then((r) => {
      console.log(JSON.stringify(r));
      if (r.status === "needs_review") process.exitCode = 2;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
