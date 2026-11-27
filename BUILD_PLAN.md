# Build Plan

<!-- remaining-tally -->
**Remaining:** AGENT 4 · LOCAL 4 · CLOUD 0 · AUTO 0 · HUMAN 0 · ADB 1 · **5 open**
<!-- /remaining-tally -->


**Sprint state:** [`docs/STATE.md`](docs/STATE.md) · **Decisions:** [`docs/DECISIONS.md`](docs/DECISIONS.md)

This file is the live board. The product work order (sprints 0–21) is [docs/PRODUCT_WORK_ORDER.md](docs/PRODUCT_WORK_ORDER.md). Finished work: [COMPLETED_TASKS.md](COMPLETED_TASKS.md).

**Who:** `AGENT` code · `HUMAN` person · `ADB` device · `AUTO` CI/scripts  
**Venue (AGENT only):** `[LOCAL]` This Computer · `[CLOUD]` Cursor Cloud  
**State:** 🔲 open · ✅ done · ❌ blocked — reason

Format: `🔲 [AGENT][LOCAL] Short task — scope: path/prefix`. Sequential `[AGENT]` first.

## Smoke gate (hard stop)

After every `[AGENT]` row: `pnpm lint` and `pnpm test` must pass (Iris stack). Template gates: `python3 scripts/agent-run.py watch-agent-gates --once --autofix --scope auto` when touching template paths.

## Backlog — Iris agent on Venice

Not the next sprint. These rows are what would make Iris edit like Cursor while the model is a Venice model. Do not start them unless a sprint says so.

- 🔲 Plan, edit several files, run the allowlisted tests, read the failure, and patch again until the task is done — scope: packages/host
- 🔲 Show the diff and let the phone accept or undo it — scope: apps/phone
- 🔲 Index the locked repo so a prompt can find the right file without reading the whole tree — scope: packages/host
- 🔲 Terminal output from the allowlisted commands comes back into the same turn — scope: packages/host
- 🔲 Language diagnostics for the locked repo, without an extension host — scope: packages/host
- 🔲 Rebuild the phone shell after a UI edit so desktop, PWA, and Android match the file — scope: apps/phone

## Backlog — switch project and new chat

Not the next sprint. A remote user must be able to point Cursor and Antigravity at the locked repo and start a fresh chat before a prompt is sent. Do not start this unless a sprint says so.

- 🔲 [AGENT][LOCAL] From the phone, open the locked repo in Cursor and Antigravity, then start a new chat in that window before the prompt is submitted — scope: packages/adapter-cursor, packages/adapter-antigravity

---

### Product (do not drift)

> Auto-managed from `AGENT.md`. Do not hand-edit inside markers. Read `AGENT.md` before any sprint row.


<!-- product-brief-sync:begin -->
Self-hosted phone remote for coding agents with cost-aware routing (direct or pool).  
Keywords: iris, remote, pwa, routing, acp, e2ee, litellm, pool, proteus, chrysaor
<!-- product-brief-sync:end -->


> Full product index is in [docs/PRODUCT_WORK_ORDER.md](docs/PRODUCT_WORK_ORDER.md) (§A3). Finished rows live in COMPLETED_TASKS.md.

### Real-device testing (open)

9. ❌ [ADB] Install APK (or PWA shortcut) on phone + tablet; pair; send one real prompt; approve one tool — scope: devices/ — blocked: b5214fc6, 8bf09993, and R52T10C5SEP are paired and b5214fc6 sent a prompt; a live tool approval is still required

### Sprint 21 — Antigravity live

<!-- parallel_exception: single blocked row, nothing to parallelize -->
1. ❌ [AGENT][LOCAL] Drive the running Antigravity IDE from the phone (prompts, history, editor tabs) — scope: packages/adapter-antigravity, apps/phone — blocked: the leg is connected on CDP :9000 and prompts plus sidebar history work; the Agents window still has no editor tabs

### Open PRs (synced)

> Auto-managed. Do not hand-edit rows inside the markers.


<!-- open-prs-sync:begin -->
_No open Dependabot or Release Please PRs._
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
- 🔲 [AGENT][LOCAL] Move iris from pnpm 9.15.9 to a maintained pnpm (11.29.x or 12.x) in packageManager and ci.yml, with an explicit allowlist of deps that need build scripts — scope: package.json,.github/workflows/ci.yml,pnpm-lock.yaml,pnpm-workspace.yaml (news P2, 2026-11-27) https://github.com/pnpm/pnpm/security/advisories/GHSA-vq4v-j7r6-jq4m
- 🔲 [AGENT][LOCAL] Set a LiteLLM floor of >=1.111.0 for pool mode (generated config, MSI/deb optional component, docs) and turn off client-supplied api_base and prompt/header logging in the generated config — scope: packages/pool/,packaging/,docs/ (news P2, 2026-11-27) https://github.com/BerriAI/litellm/security/advisories
<!-- local-agent-lane:end -->


### Cloud agent (Cursor Cloud)

Standing queue for Cursor Cloud. Rows: `🔲 [AGENT][CLOUD] … — scope: path`.


<!-- cloud-agent-lane:begin -->
_No cloud agent items._
<!-- cloud-agent-lane:end -->


---

## Ongoing Maintenance

Not a checklist. Monday cron and Dependabot own hygiene. Product sprints are in [docs/PRODUCT_WORK_ORDER.md](docs/PRODUCT_WORK_ORDER.md).

## Archive

Sprints 0–20 and Phone UI absorb: see [COMPLETED_TASKS.md](COMPLETED_TASKS.md) (@ `d1c692b`).

Product work order: [docs/PRODUCT_WORK_ORDER.md](docs/PRODUCT_WORK_ORDER.md).
