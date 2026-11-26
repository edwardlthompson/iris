# State

Last completed: sprint 4 (acp-adapter)
Next: sprint 5 (claude-adapter)
Branch in progress: none
PR: https://github.com/edwardlthompson/iris/pull/9 (base: sprint/03-lan-transport)
Blockers: none
Notes for the next agent:
- `@iris/adapter-acp`: NDJSON JSON-RPC client + FixtureAgent (stream, elicitation, tool permission, cancel). `ACP_CAPABILITIES.baseUrlOverride=true`.
- Stack PRs: #5–#8 then #9 ACP. Merge order matters (base chain).
- Next: `packages/adapter-claude`. Branch `sprint/05-claude-adapter` from `sprint/04-acp-adapter` until #9 merges.
- FOSS path: prefer Agent SDK only if MIT/Apache; otherwise stub `query()` behind an interface (no proprietary SDK on production path).
