# State

Last completed: sprint 5 (claude-adapter)
Next: sprint 6 (thread-store)
Branch in progress: sprint/05-claude-adapter
Blockers: none
Notes for the next agent:
- `@iris/adapter-claude`: FOSS `ClaudeRuntime` + `StubClaudeRuntime` (no proprietary Agent SDK). Session wires canUseTool→approvals, rate_limits→QuotaStore, baseUrl→ANTHROPIC_BASE_URL.
- Stack PRs: #5–#9 then this branch. Merge order matters.
- Next: `packages/thread`. Branch `sprint/06-thread-store` from `sprint/05-claude-adapter` until this PR merges.
