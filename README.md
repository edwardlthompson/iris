# Iris

![MIT](https://img.shields.io/badge/license-MIT-2ea043?style=flat-square)
![Template](https://img.shields.io/badge/template-1.13.2-0969da?style=flat-square)
![FOSS](https://img.shields.io/badge/FOSS-no_tracking-656d76?style=flat-square)
[![CI](https://img.shields.io/github/actions/workflow/status/edwardlthompson/iris/ci.yml?style=flat-square&label=CI)](https://github.com/edwardlthompson/iris/actions/workflows/ci.yml)
[![Pages demo](https://img.shields.io/badge/Pages-demo-0969da?style=flat-square)](https://edwardlthompson.github.io/iris/)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/edwardlthompson/iris/badge)](https://securityscorecards.dev/viewer/?uri=github.com/edwardlthompson/iris)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/14564/badge)](https://www.bestpractices.dev/projects/14564)
![AGENT](https://img.shields.io/badge/AGENT-2ea043?style=flat-square)
![HUMAN](https://img.shields.io/badge/HUMAN-0969da?style=flat-square)
![ADB](https://img.shields.io/badge/ADB-bf8700?style=flat-square)
![AUTO](https://img.shields.io/badge/AUTO-656d76?style=flat-square)
![web](https://img.shields.io/badge/web-stack-646cff?style=flat-square)
![python](https://img.shields.io/badge/python-stack-3776AB?style=flat-square)
![android](https://img.shields.io/badge/android-stack-3DDC84?style=flat-square)

Self-hosted phone remote for coding agents, with cost-aware routing.

Iris runs agents on the owner's machine and routes every prompt to the cheapest agent that can finish it. Local by default. No account. No hosted backend.

GitHub Pages demo: https://edwardlthompson.github.io/iris/

## Start here

| Doc | Role |
|---|---|
| [`docs/STATE.md`](docs/STATE.md) | Last completed sprint, next sprint, blockers |
| [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) | Full work order (Parts A–C + appendices) |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Choices made during sprints |

**Agents:** read `docs/STATE.md`, then execute exactly one sprint from `docs/BUILD_PLAN.md`. Commit on `sprint/NN-slug`. Never continue into the next sprint.

## Stack

TypeScript · Node 22 · pnpm workspaces · vitest · eslint + prettier · tsup · zod

```bash
pnpm install
pnpm lint
pnpm test
```

## Licence

MIT. Bootstrapped from [agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap).
