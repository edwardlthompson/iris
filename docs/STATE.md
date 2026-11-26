# State

Last completed: sprint 1 (protocol-schemas) — PR https://github.com/edwardlthompson/iris/pull/6
Next: sprint 2 (host-daemon-pairing)
Branch in progress: none
Blockers: none (template `watch-agent-gates --scope auto` exit 2 locally: multi-stack mypy missing — not Iris product)
Notes for the next agent:
- `@iris/protocol` ships zod schemas for thread events, handoff.v1, ledger, capabilities, Pool/ModelCard, provenance, repo config. Tests: full-thread fixture + path-aware rejection.
- Product gates: `pnpm lint` && `pnpm test`. Prefer `--stack node` over full multi until examples are pruned.
- PR #6 includes rebased sprint 0 + sprint 1; PR #5 is superseded.
- Never commit to `main`; next branch `sprint/02-host-daemon`.
- Decisions: `docs/DECISIONS.md`. Work order: `docs/BUILD_PLAN.md`.
- Stopped after sprint 1 (Iris one-sprint + watch-agent-gates exit 2). Do not auto-chain sprint 2 without a fresh session/`/build`.
