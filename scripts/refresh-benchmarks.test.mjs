import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  sha256,
  stalenessBadge,
  parseCursorBenchHtml,
  guardrails,
  formatBenchmarksMd,
} from "./lib/refresh-benchmarks-core.mjs";
import { refreshBenchmarks } from "./refresh-benchmarks.mjs";

function tableHtml(rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.model}</td><td>${r.effort}</td><td>${r.score}%</td><td>$${r.usd}</td><td>${r.tok}</td><td>${r.steps}</td></tr>`,
    )
    .join("");
  return `<table><tr><td>Model</td><td>Effort</td><td>Score</td><td>$/task</td><td>Tok</td><td>Steps</td></tr>${body}</table>`;
}

function manyRows(n, score = 40) {
  return Array.from({ length: n }, (_, i) => ({
    model: `Model ${i}`,
    effort: "high",
    score,
    usd: 1 + i * 0.01,
    tok: 1000,
    steps: 10,
  }));
}

test("unchanged page commits nothing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "iris-bench-"));
  const outPath = path.join(dir, "BENCHMARKS.md");
  const html = tableHtml(manyRows(25));
  const hash = sha256(html);
  const md = formatBenchmarksMd(
    {
      source: "https://example.test",
      fetched_at: new Date().toISOString(),
      body_sha256: hash,
      row_count: 25,
    },
    parseCursorBenchHtml(html),
  );
  await writeFile(outPath, md, "utf8");
  const before = await readFile(outPath, "utf8");
  const result = await refreshBenchmarks({ html, outPath, reviewPath: path.join(dir, "nr.md") });
  assert.equal(result.status, "unchanged");
  assert.equal(await readFile(outPath, "utf8"), before);
});

test("shrunken page opens needs review", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "iris-bench-"));
  const outPath = path.join(dir, "BENCHMARKS.md");
  const reviewPath = path.join(dir, "BENCHMARKS.needs-review.md");
  const big = tableHtml(manyRows(40));
  await writeFile(
    outPath,
    formatBenchmarksMd(
      {
        source: "https://example.test",
        fetched_at: new Date().toISOString(),
        body_sha256: sha256(big),
        row_count: 40,
      },
      parseCursorBenchHtml(big),
    ),
    "utf8",
  );
  const small = tableHtml(manyRows(10));
  const result = await refreshBenchmarks({ html: small, outPath, reviewPath });
  assert.equal(result.status, "needs_review");
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /needs review/i);
  assert.match(review, /30% drop|under 20/);
});

test("31-day-old table shows est. stale badge", () => {
  const fetched = new Date(Date.now() - 31 * 86_400_000).toISOString();
  assert.equal(stalenessBadge(fetched), "est. stale");
});

test("guardrails reject empty and out-of-band scores", () => {
  assert.ok(guardrails([]).length > 0);
  assert.ok(guardrails([{ model: "x", effort: "a", score: 90, usd_per_task: 1, tok_per_task: 1, steps: 1 }]).length > 0);
});
