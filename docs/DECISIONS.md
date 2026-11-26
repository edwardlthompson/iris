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
## Appendix F (imported)

See `docs/BUILD_PLAN.md` Appendix F for product decisions 1–14 already made.
