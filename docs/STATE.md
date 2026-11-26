# State

Last completed: sprint 1 (protocol-schemas)
Next: sprint 2 (host-daemon-pairing)
Branch in progress: sprint/01-protocol-schemas
Blockers: none
Notes for the next agent:
- `@iris/protocol` ships zod schemas for thread events, handoff.v1, ledger, capabilities, Pool/ModelCard, provenance, repo config. Tests: full-thread fixture + path-aware rejection.
- Product gates: `pnpm lint` && `pnpm test`. Template `watch-agent-gates --scope auto` may need `npm ci` in `examples/web` and `examples/node`.
- Sprint 0 PR #5 conflicts with main after rebase; this branch includes rebased sprint 0 + sprint 1. Prefer merging this PR (or force-push #5 with lease by a human).
- Never commit to `main`; next branch `sprint/02-host-daemon`.
- Decisions: `docs/DECISIONS.md`. Work order: `docs/BUILD_PLAN.md`.
