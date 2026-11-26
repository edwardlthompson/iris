# State

Last completed: sprint 6 (thread-store)
Next: sprint 7 (ledger)
Branch in progress: none
PR: https://github.com/edwardlthompson/iris/pull/11 (base: sprint/05-claude-adapter)
Blockers: none
Notes for the next agent:
- `@iris/thread`: NDJSON append + atomic rename flush, redaction, rotate at 500, replay.
- Vitest resolves `@iris/*` via `vitest.config.ts` aliases (no dist required for tests).
- Stack PRs: #5–#11. Merge order matters.
- Next: `packages/ledger`. Branch `sprint/07-ledger` from `sprint/06-thread-store` until #11 merges.
