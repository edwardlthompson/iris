# Build Plan

<!-- remaining-tally -->
**Remaining:** AGENT 2 · LOCAL 2 · CLOUD 0 · AUTO 3 · HUMAN 0 · ADB 0 · **5 open**
<!-- /remaining-tally -->

**Iris product work order:** [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)  
**Sprint state:** [`docs/STATE.md`](docs/STATE.md) · **Decisions:** [`docs/DECISIONS.md`](docs/DECISIONS.md)

Live board for the Iris product. Finished work: [`COMPLETED_TASKS.md`](COMPLETED_TASKS.md).

**Who:** `AGENT` code · `HUMAN` person · `ADB` device · `AUTO` CI/scripts  
**Venue (AGENT only):** `[LOCAL]` This Computer · `[CLOUD]` Cursor Cloud  
**State:** 🔲 open · ✅ done · ❌ blocked — reason

Format: `🔲 [AGENT][LOCAL] Short task — scope: path/prefix`. Sequential `[AGENT]` first.

## Smoke gate (hard stop)

After every `[AGENT]` row: `pnpm lint` and `pnpm test` must pass (Iris stack). Template gates: `python3 scripts/agent-run.py watch-agent-gates --once --autofix --scope auto` when touching template paths.

---

### Product (do not drift)

> Auto-managed from `AGENT.md`. Do not hand-edit inside markers. Read `AGENT.md` before any sprint row.

<!-- product-brief-sync:begin -->
Self-hosted phone remote for coding agents with cost-aware routing (direct or pool).
Keywords: iris, remote, pwa, routing, acp, e2ee, litellm, pool, proteus, chrysaor
<!-- product-brief-sync:end -->

### Sprint 0 — Bootstrap

<!-- parallel_exception: sequential bootstrap; docs and monorepo share root package.json -->

1. ✅ [AGENT][LOCAL] Create repo from agent-project-bootstrap; topics; clone — scope: .
2. ✅ [AGENT][LOCAL] Replace README; write docs/BUILD_PLAN.md, STATE.md, DECISIONS.md — scope: docs/
3. ✅ [AGENT][LOCAL] Scaffold pnpm monorepo (Node 22, vitest, eslint, prettier, tsup, zod) — scope: packages/workspace
4. ✅ [AGENT][LOCAL] Add Iris CI job; keep template hygiene gates green — scope: .github/workflows/ci.yml
5. ✅ [AUTO] Sprint 0 sign-off: `pnpm lint` · `pnpm test` · CI green on PR

### Sprint 1 — Protocol + schemas

<!-- parallel_exception: single package packages/protocol; see docs/BUILD_PLAN.md Sprint 1 -->

1. 🔲 [AGENT][LOCAL] Zod schemas for events, handoff.v1, ledger, capabilities, provenance, Pool, ModelCard — scope: packages/protocol
2. 🔲 [AGENT][LOCAL] Round-trip + rejection tests; full-thread fixture — scope: packages/protocol

### Open PRs (synced)

> Auto-managed. Do not hand-edit rows inside the markers.

<!-- open-prs-sync:begin -->
- 🔲 [AUTO] Merge Dependabot [#4](https://github.com/edwardlthompson/iris/pull/4) (Bump the github-actions group with 3 updates)
- 🔲 [AUTO] Merge Dependabot [#3](https://github.com/edwardlthompson/iris/pull/3) (Bump the android-dependencies group in /examples/android with 3 updates)
- 🔲 [AUTO] Merge Dependabot [#1](https://github.com/edwardlthompson/iris/pull/1) (Bump the node-dependencies group in /examples/node with 5 updates)
<!-- open-prs-sync:end -->

### Template gaps (synced)

> Auto-managed. Do not hand-edit inside markers.

<!-- template-gaps-sync:begin -->
_No template gaps; .template-version matches upstream (or template maintainer N/A)._
<!-- template-gaps-sync:end -->

### UX & UI inventory

<!-- ux-inventory:begin -->
_No UX inventory items._
<!-- ux-inventory:end -->

### Local agent (This Computer)

Standing queue for This Computer. Rows: `🔲 [AGENT][LOCAL] … — scope: path`.

<!-- local-agent-lane:begin -->
_No local agent items._
<!-- local-agent-lane:end -->

### Cloud agent (Cursor Cloud)

Standing queue for Cursor Cloud. Rows: `🔲 [AGENT][CLOUD] … — scope: path`.

<!-- cloud-agent-lane:begin -->
_No cloud agent items._
<!-- cloud-agent-lane:end -->

---

## Ongoing Maintenance

Not a checklist. Monday cron and Dependabot own hygiene. Product sprints stay in `docs/BUILD_PLAN.md`.

## Archive

Sprint completions land in [`COMPLETED_TASKS.md`](COMPLETED_TASKS.md).
