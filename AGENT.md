# AGENT.md — Iris product brief (Sacred)

<!-- agent-brief:one-liner -->
Self-hosted phone remote for coding agents with cost-aware routing (direct or pool).
<!-- /agent-brief:one-liner -->

<!-- agent-brief:keywords -->
iris, remote, pwa, routing, acp, e2ee, litellm, pool, proteus, chrysaor
<!-- /agent-brief:keywords -->

## Rules

- Execute exactly one sprint per session from `docs/BUILD_PLAN.md`.
- Read `docs/STATE.md` first; never commit to `main`; branch `sprint/NN-slug`.
- Transparent routing; local by default; free to run; show the numbers.
- Phone UI is additive only (absorb `cursor-remote-lite`), not redesigned.
- Topology is a per-repo user choice (`direct` default, `pool` opt-in).
- Iris speaks OpenAI-compatible HTTP only; LiteLLM binds `127.0.0.1` only.
- Caps enforced locally; pool keys never live in Iris.

## First milestone

Sprints 0–13 (MVP): typed protocol through benchmark refresh. Usable product above the cut line.
