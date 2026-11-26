# State

Last completed: sprint 0 (bootstrap) — PR https://github.com/edwardlthompson/iris/pull/5
Next: sprint 1 (protocol-schemas) — after PR #5 merges and CI is green
Branch in progress: none (sprint/00-bootstrap open as PR #5)
Blockers: none
Notes for the next agent:
- Product plan is `docs/BUILD_PLAN.md` (verbatim). Root `BUILD_PLAN.md` is template-gate shaped only.
- Stack: TypeScript / Node 22+ / pnpm workspaces. CI Iris job pins Node 24.22.3 (template pin); `.nvmrc` is 22.
- `@iris/workspace` is a sprint-0 smoke package only. Sprint 1 creates `packages/protocol` with zod schemas.
- Template `examples/*` still present so golden-path CI jobs keep running; do not delete in sprint 1 unless needed.
- Run `pnpm install && pnpm lint && pnpm test` before claiming done. Never commit to `main`; branch `sprint/01-protocol-schemas`.
- Decisions log: `docs/DECISIONS.md`.
