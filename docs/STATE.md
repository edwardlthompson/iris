# State

Last completed: sprint 5 (claude-adapter)
Next: sprint 6 (thread-store)
Branch in progress: none
PR: https://github.com/edwardlthompson/iris/pull/10 (base: sprint/04-acp-adapter)
Blockers: none
Notes for the next agent:
- `@iris/adapter-claude`: FOSS `ClaudeRuntime` + `StubClaudeRuntime` (no proprietary Agent SDK). Session wires canUseTool→approvals, rate_limits→QuotaStore, baseUrl→ANTHROPIC_BASE_URL.
- Stack PRs: #5–#9 then #10. Merge order matters.
- Next: `packages/thread`. Branch `sprint/06-thread-store` from `sprint/05-claude-adapter` until #10 merges.
