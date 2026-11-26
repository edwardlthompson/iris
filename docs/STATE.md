# State

Last completed: sprint 3 (lan-transport)
Next: sprint 4 (acp-adapter)
Branch in progress: sprint/03-lan-transport
Blockers: none
Notes for the next agent:
- `@iris/relay-core`: LAN rung only, Memory/LanDiscovery, WSS + XSalsa20-Poly1305 frames, reconnect backoff, active-rung reporting. Tests: round-trip + drop/reconnect.
- `gate_scope.py` maps `packages/` and `apps/` → node stack (avoids full 8-stack WSL fail).
- Real multicast DNS deferred; LanDiscovery is localhost registry with the same interface.
- Next: `packages/adapter-acp`. Branch `sprint/04-acp-adapter`.
