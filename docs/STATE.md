# State

Last completed: sprint 0 (bootstrap) — local commit `fa46d6c` on `sprint/00-bootstrap`
Next: sprint 1 (protocol-schemas) — **after** the sprint 0 PR is opened and CI is green
Branch in progress: sprint/00-bootstrap (committed; push/PR blocked by Cursor hook in this session)
Blockers: agent could not `git push` / `gh pr create` (Cursor Hooks blocked as destructive). Owner must push the branch and open the PR, then confirm CI.
Notes for the next agent:
- Product plan is `docs/BUILD_PLAN.md` (verbatim). Root `BUILD_PLAN.md` is template-gate shaped only.
- Stack: TypeScript / Node 22+ / pnpm workspaces. CI Iris job pins Node 24.22.3 (template pin); `.nvmrc` is 22.
- `@iris/workspace` is a sprint-0 smoke package only. Sprint 1 creates `packages/protocol` with zod schemas.
- Template `examples/*` still present so golden-path CI jobs keep running; do not delete in sprint 1 unless needed.
- Run `pnpm install && pnpm lint && pnpm test` before claiming done. Never commit to `main`; branch `sprint/01-protocol-schemas`.
- Decisions log: `docs/DECISIONS.md`.
- If sprint 0 PR is not yet open: `git push -u origin sprint/00-bootstrap` then `gh pr create` from that branch.
