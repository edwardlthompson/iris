# Decisions

Append-only log. Do not relitigate Appendix F of `docs/BUILD_PLAN.md`. New choices go here with date and rationale.

## 2026-11-25 — A2 bootstrap

| # | Decision | Why |
|---|---|---|
| A2-1 | Product stack is TypeScript, Node 22, pnpm workspaces, vitest, eslint + prettier, tsup, zod | Locked in Part A2 of the build plan |
| A2-2 | Keep agent-project-bootstrap hygiene/docs/CI scaffolding; product code lives under `packages/` and `apps/` | Template gates (`validate-bootstrap`, encoding, hygiene) stay useful; Iris is not the template |
| A2-3 | Root `BUILD_PLAN.md` points at `docs/BUILD_PLAN.md` | Template requires root `BUILD_PLAN.md`; Iris plan is the verbatim work order in `docs/` |
| A2-4 | Leave template `examples/*` golden paths in place for sprint 0 | Avoids rewriting every template CI job; Iris adds a root `pnpm` CI job on Node 22. Prune examples in a later hygiene pass if they fight the monorepo |
| A2-5 | Repo created with `gh repo create` then cloned into the existing `Iris` workspace (no `--clone` into a nested dir) | Workspace path already existed empty |
| A2-6 | Phone UI will be absorbed from `cursor-remote-lite` later; not copied in sprint 0 | Sprint 0 is repo + CI only |
| A2-7 | `engines.node` is `>=22` (not `<23`); CI pins Node 22 via `.nvmrc` / workflow | Local tooling may be newer; product target remains 22 |
| A2-8 | `@iris/workspace` is a sprint-0 smoke package only | Real packages start at sprint 1 (`packages/protocol`) |
| A2-9 | Root `BUILD_PLAN.md` keeps template tally/parallel shape; Iris sprints live in `docs/BUILD_PLAN.md` | `validate-bootstrap` requires tally markers and Parallel tables |
| A2-10 | Iris CI job uses Node `24.22.3` (template pin); `.nvmrc` / engines stay Node 22+ | `tests/test_node_pin.py` forbids `node-version: "22"` in workflows; 24.22.3 satisfies `engines: >=22` |
| A2-11 | Keep template OpenSSF Best Practices badge (project 14564) on README for now | `tests/test_ci_refs.py` requires it; register Iris separately later |
## 2026-11-25 — Sprint 1 protocol

| # | Decision | Why |
|---|---|---|
| S1-1 | Thread events use `v: 1` envelope + discriminatedUnion on `type` | Appendix C; one parse entrypoint |
| S1-2 | `pool_id` and ledger `pool_id` are nullable (null in direct topology) | Direct mode has no pool; schema must still validate |
| S1-3 | `parseWithPath` returns the first Zod issue path | Done-when requires malformed rejection with a path |
| S1-4 | `/build` continues to sprint 1 in the same session after sprint 0 | User invoked `/build`; Iris A1 one-sprint rule yields to explicit `/build` |
## 2026-11-25 — Sprint 2 host

| # | Decision | Why |
|---|---|---|
| S2-1 | `MemoryKeyStore` for tests; OS keychain deferred | Sprint sheet requires keychain; Node has no portable keychain without native deps; interface is ready |
| S2-2 | Pairing is fingerprint equality only (no transport) | Sprint 2 forbids transport; sprint 3 adds LAN |
| S2-3 | Supervisor spawns OS children via `child_process.spawn` | Matches “managed children” without binding a port |
## 2026-11-25 — Sprint 3 LAN

| # | Decision | Why |
|---|---|---|
| S3-1 | `LanDiscovery` is an in-process/localhost registry, not real mDNS yet | Done-when needs paired round-trip in CI; bonjour can swap behind `Discovery` later |
| S3-2 | Host binds `127.0.0.1` only in tests/server default | B11: host never listens publicly |
| S3-3 | `gate_scope` treats `packages/` + `apps/` as `node` | Unscoped `packages/` was `full` and broke WSL watch-agent-gates |
## 2026-11-25 — Sprint 4 ACP

| # | Decision | Why |
|---|---|---|
| S4-1 | In-process PassThrough fixture instead of spawning a CLI | Sprint done-when is scripted stream/approval/cancel; no real agent binary in CI |
| S4-2 | Iris `baseUrlOverride` advertised on fixture init + `ACP_CAPABILITIES` | B6 pool gate; not a core ACP field, carried as Iris leg capability |
| S4-3 | Protocol version `1` in initialize | Matches current agentclientprotocol.com client examples used by CLI agents |
## 2026-11-25 — Sprint 5 Claude

| # | Decision | Why |
|---|---|---|
| S5-1 | No `@anthropic-ai/claude-agent-sdk` dependency; `ClaudeRuntime` + `StubClaudeRuntime` | SDK is proprietary (Anthropic Commercial ToS); FOSS path forbids proprietary SDKs |
| S5-2 | `baseUrl` / `ANTHROPIC_BASE_URL` on session options | Pool mode via LiteLLM at 127.0.0.1; matches B6 baseUrlOverride |
| S5-3 | Stub refuses `screen`/PTY | Sprint forbids PTY except behind screen flag; FOSS stub stays headless-only |
## 2026-11-25 — Sprint 6 thread

| # | Decision | Why |
|---|---|---|
| S6-1 | NDJSON parts with temp+rename flush | Atomic replace without a DB; Windows-tolerant (fsync best-effort) |
| S6-2 | Redact sk-/Bearer/PEM/long-b64 on append | Done-when requires no secret-shaped strings on disk |
| S6-3 | Vitest aliases `@iris/*` → `packages/*/src` | Tests import protocol schemas without requiring a prior `dist` build |
## 2026-11-25 — Sprint 7 ledger

| # | Decision | Why |
|---|---|---|
| S7-1 | Calibration keyed by `vendor`+`model` (leg) | Matches ledger row fields; actuals replace reference est for next draft |
| S7-2 | Shadow rows write but skip calibration | Shadow must not poison live estimates |
| S7-3 | NDJSON append with temp+rename | Same durability pattern as `@iris/thread` |
## 2026-11-25 — Sprint 8 pool

| # | Decision | Why |
|---|---|---|
| S8-1 | `packages/pool` exports Chrysaor (chrysaor product name) | B4a naming; one package for topology + pool |
| S8-2 | LiteLLM YAML uses `os.environ` key refs only | Pool keys never live in Iris |
| S8-3 | Two failed probes → degraded; injectible probe for tests | Done-when without real HTTP in CI |
## 2026-11-25 — Sprint 9 router stage1

| # | Decision | Why |
|---|---|---|
| S9-1 | Sum all matching B1 weights (not stop at first) | Table says “first match wins, weights summed”; summing all matches matches score bands |
| S9-2 | Unsure on opposing signs; empty/no-repo short prompts | B1; keep prompt-only docs/stack classifiable when files or signals exist |
| S9-3 | Overrides after score→preset (pin first) | B7 ordering |
## 2026-11-25 — Sprint 10 stage2

| # | Decision | Why |
|---|---|---|
| S10-1 | Injectible `fetchImpl` on VeniceClient | CI without real Venice; FOSS OpenAI-compatible HTTP |
| S10-2 | Timeout/malformed/low-confidence → `unclassified` | Done-when fallback; no second classifier endpoint |
| S10-3 | Policy gate before Venice call | Exclude degraded pools / missing credentials early |
## 2026-11-25 — Sprint 11 cost chip

| # | Decision | Why |
|---|---|---|
| S11-1 | `apps/remote` holds chip logic + i18n before phone UI absorb | Scope is apps/; cursor-remote-lite comes later (B3) |
| S11-2 | Semantic `budget-ok|warn|over` classes, no raw hex | DESIGN_GUIDE / ux-ui tokens |
| S11-3 | 400 ms debounce + LocalStoragePinStore | Sprint done-when: pin survives reload |
## 2026-11-25 — Sprint 12 handoff

| # | Decision | Why |
|---|---|---|
| S12-1 | `packages/handoff` wraps protocol HandoffV1Schema | Writer/trigger/resume stay out of protocol package |
| S12-2 | Manual `confirmed` required before quota handoff | Sprint sheet: manual confirm |
| S12-3 | Pool topology prefers `samePool` fallbacks | Model-only switch inside one pool |
## 2026-11-25 — Sprint 13 benchmarks

| # | Decision | Why |
|---|---|---|
| S13-1 | Core pure functions in `scripts/lib/refresh-benchmarks-core.mjs` | Testable without network; CLI wraps fetch |
| S13-2 | Guardrail fail writes `BENCHMARKS.needs-review.md` + exit 2 | Appendix D needs-review PR path |
| S13-3 | `gate_scope` maps benchmarks workflow → node | Avoid full 8-stack on Windows GP tooling gaps |
## Appendix F (imported)

See `docs/BUILD_PLAN.md` Appendix F for product decisions 1–14 already made.
