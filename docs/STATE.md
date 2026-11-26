# State

Last completed: sprint 2 (host-daemon-pairing)
Next: sprint 3 (lan-transport)
Branch in progress: sprint/02-host-daemon
Blockers: none (template `watch-agent-gates --scope auto` exit 2 on WSL web/typescript-linux-x64 — Iris uses `pnpm lint`/`pnpm test`)
Notes for the next agent:
- `@iris/host` (portunus): X25519 + 6-digit fingerprint pairing, MemoryKeyStore (OS keychain deferred), Supervisor maxConcurrent=4 / idleTtl=90s, SIGTERM shutdown, JSON logs, CLI `iris-host`.
- Product gates: `pnpm lint` && `pnpm test`. Do not bind ports / transport until sprint 3.
- Branch stacks on sprint/01 work; open a PR against main after #6 merges or include both.
- Next: `packages/relay-core` LAN only (docs/BUILD_PLAN.md Sprint 3). Branch `sprint/03-lan-transport`.
