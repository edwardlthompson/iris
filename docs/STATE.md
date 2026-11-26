# State

Last completed: sprint 6 (thread-store)
Next: sprint 7 (ledger)
Branch in progress: sprint/06-thread-store
Blockers: none
Notes for the next agent:
- `@iris/thread`: NDJSON append + atomic rename flush, redaction, rotate at 500, replay.
- Vitest resolves `@iris/*` via `vitest.config.ts` aliases (no dist required for tests).
- Stack PRs through #10; this branch stacks on `sprint/05-claude-adapter`.
- Next: `packages/ledger`. Branch `sprint/07-ledger`.
