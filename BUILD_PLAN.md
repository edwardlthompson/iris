# Build Plan

<!-- remaining-tally -->
**Remaining:** AGENT 8 · LOCAL 8 · CLOUD 0 · AUTO 0 · HUMAN 1 · ADB 1 · **10 open**
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

> Full product index also in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) §A3. Finished rows live in COMPLETED_TASKS.md.

### Sprint 0 — Bootstrap

> **Sprint 0** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 1 — Protocol + schemas

> **Sprint 1** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 2 — Host daemon + pairing

> **Sprint 2** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 3 — LAN transport

> **Sprint 3** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 4 — ACP adapter

> **Sprint 4** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 5 — Claude adapter

> **Sprint 5** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 6 — Thread store + replay

> **Sprint 6** archived in COMPLETED_TASKS.md @ `9054c56`.

### Sprint 7 — Ledger + calibration

> **Sprint 7** archived in COMPLETED_TASKS.md @ `ac3ca00`.

### Sprint 8 — Topology + pool layer

> **Sprint 8** archived in COMPLETED_TASKS.md @ `5ca9cab`.

### Sprint 9 — Stage 1 classifier

> **Sprint 9** archived in COMPLETED_TASKS.md @ `d010bae`.

### Sprint 10 — Stage 2 + policy gate

> **Sprint 10** archived in COMPLETED_TASKS.md @ `bef46ab`.

### Sprint 11 — Presets + cost chip

> **Sprint 11** archived in COMPLETED_TASKS.md @ `07ffc99`.

### Sprint 12 — Handoff v1

> **Sprint 12** archived in COMPLETED_TASKS.md @ `79d3033`.

### Sprint 13 — Benchmark refresh

> **Sprint 13** archived in COMPLETED_TASKS.md @ `83ac224`.

> **MVP cut line** — sprints 0–13 are the usable product. 14–18 are post-MVP.

### Sprint 14 — Antigravity adapter

> **Sprint 14** archived in COMPLETED_TASKS.md @ `7061c04`.

### Sprint 15 — Packaging

> **Sprint 15** archived in COMPLETED_TASKS.md @ `02c46ac`.

### Sprint 16 — Fit report

> **Sprint 16** archived in COMPLETED_TASKS.md @ `36d3020`.

### Sprint 17 — Shadow → auto

> **Sprint 17** archived in COMPLETED_TASKS.md @ `a0e11fa`.

### Sprint 18 — Push + Capacitor

> **Sprint 18** archived in COMPLETED_TASKS.md @ `93ba74f`.

### Real-device testing (Cursor first)

> Goal: phone ↔ host ↔ Cursor works for real prompts/approvals on this PC + ADB devices.
> Smoke today: LAN reachability + JSON pair/status/prompt routing ack. Items below are the remaining blockers.

1. 🔲 [AGENT][LOCAL] Cursor IDE bridge — drive Composer/Agent from host (replace bridge_pending ack) — scope: packages/adapter-cursor
2. 🔲 [AGENT][LOCAL] Live Cursor credit/model inventory (API or UI scrape), not static composer=funded — scope: packages/adapter-cursor
3. 🔲 [AGENT][LOCAL] End-to-end sealed relay frames on phone (shared key), drop plaintext control for production — scope: packages/relay-core
4. 🔲 [AGENT][LOCAL] Absorb cost chip + approval sheet into phone PWA (from apps/remote + cursor-remote-lite) — scope: apps/phone
5. 🔲 [AGENT][LOCAL] Host tray app (Windows) with always-on relay + pairing QR/code — scope: packaging/windows
6. 🔲 [AGENT][LOCAL] Unsigned Android APK via Capacitor (needs ANDROID_HOME) — scope: apps/phone
7. 🔲 [AGENT][LOCAL] Tool-approval round-trip: Cursor canUseTool → phone Allow/Deny → resume — scope: packages/host
8. 🔲 [AGENT][LOCAL] Persist paired sessions across host restart (OS keychain, not MemoryKeyStore) — scope: packages/host
9. 🔲 [HUMAN] Confirm Cursor is signed in with remaining credits on this PC; note which models still have quota
10. 🔲 [ADB] Install APK (or PWA shortcut) on phone + tablet; pair; send one real prompt; approve one tool — scope: devices/

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

| Sprint | Complete | COMPLETED_TASKS.md |
|---|---|---|
| Sprint 0 — Bootstrap | 2026-11-25 | Sprint 0 — Bootstrap |
| Sprint 1 — Protocol + schemas | 2026-11-25 | Sprint 1 — Protocol + schemas |
| Sprint 2 — Host daemon + pairing | 2026-11-25 | Sprint 2 — Host daemon + pairing |
| Sprint 3 — LAN transport | 2026-11-25 | Sprint 3 — LAN transport |
| Sprint 4 — ACP adapter | 2026-11-25 | Sprint 4 — ACP adapter |
| Sprint 5 — Claude adapter | 2026-11-25 | Sprint 5 — Claude adapter |
| Sprint 6 — Thread store + replay | 2026-11-25 | Sprint 6 — Thread store + replay |
| Sprint 7 — Ledger + calibration | 2026-11-25 | Sprint 7 — Ledger + calibration |
| Sprint 8 — Topology + pool layer | 2026-11-25 | Sprint 8 — Topology + pool layer |
| Sprint 9 — Stage 1 classifier | 2026-11-25 | Sprint 9 — Stage 1 classifier |
| Sprint 10 — Stage 2 + policy gate | 2026-11-25 | Sprint 10 — Stage 2 + policy gate |
| Sprint 11 — Presets + cost chip | 2026-11-25 | Sprint 11 — Presets + cost chip |
| Sprint 12 — Handoff v1 | 2026-11-25 | Sprint 12 — Handoff v1 |
| Sprint 13 — Benchmark refresh | 2026-11-25 | Sprint 13 — Benchmark refresh |
| Sprint 14 — Antigravity adapter | 2026-11-25 | Sprint 14 — Antigravity adapter |
| Sprint 15 — Packaging | 2026-11-25 | Sprint 15 — Packaging |
| Sprint 16 — Fit report | 2026-11-25 | Sprint 16 — Fit report |
| Sprint 17 — Shadow → auto | 2026-11-25 | Sprint 17 — Shadow → auto |
| Sprint 18 — Push + Capacitor | 2026-11-25 | Sprint 18 — Push + Capacitor |
