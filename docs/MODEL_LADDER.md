# Model ladder

The chart is [model-ladder.html](model-ladder.html). Open that file in the Iris files pane. The host tries models in this efficiency order: Haiku 5.5 max, Sonnet 5.5 xhigh, Opus 5.5 high, Fable 5.2 max, then Grok from low to xhigh. Grok is below the frontier.

Human-readable ranking for Iris. Scores are CursorBench 4.0, fetched 2026-11-25, Cursor harness with tools on. Gemini 4 Neon (65.4%) has no published price, so it is not on the chart. A gap under about 1 point is noise.

The chart is the same picture as the CursorBench frontier plot: score up, cost across on a log scale, dashed line where nothing is both better and cheaper.

The frontier chart is the four callouts in the table below. The files pane shows markdown, not an embedded drawing.



## What Iris routes today

The live ladder is a fixed list. It does not yet read this frontier. Inside a level it keeps the first row that still has quota, then drops a level when that quota is gone.

| Level | Order Iris tries | CursorBench | $/task |
|---|---|---:|---:|
| Any ceiling, Claude signed in | Haiku 5.5 max, then Sonnet 5.5 xhigh, Opus 5.5 high, Fable 5.2 max | 48.4 / 53.1 / 56.0 / 60.0 | 1.12 / 2.81 / 3.97 / 32.79 |
| Claude off | Grok 4.7 low, then medium, high, xhigh, then Antigravity Flash | 33.1 / 41.6 / 43.9 / 46.3 | 1.58 / 3.49 / 4.69 / 6.01 |

Antigravity and Claude scores on that list are placeholders. Only the Grok rows are CursorBench numbers. Grok has no max-effort row, so Max is Grok at xhigh.

## Best published model in each band

Bands follow the cost of the Grok row Iris uses for that level. The winner is the highest CursorBench score at or below that cost.

| Level | Cost band | Best published row | Score | $/task | What Iris sends instead |
|---|---|---|---:|---:|---|
| Savings | up to $1.58 | Claude Haiku 5.5 max | 48.4% | 1.12 | Grok 4.7 low, 33.1% at $1.58 |
| Balanced | up to $3.49 | Claude Sonnet 5.5 xhigh | 53.1% | 2.81 | Grok 4.7 medium, 41.6% at $3.49 |
| Performance | up to $4.69 | Claude Opus 5.5 high | 56.0% | 3.97 | Grok 4.7 high, 43.9% at $4.69 |
| Max | no cap | Claude Fable 5.2 max | 60.0% | 32.79 | Grok 4.7 xhigh, 46.3% at $6.01 |

Opus 5.5 high is the important one. It scores 56.0% at $3.97, which is above every Grok row and cheaper than Grok xhigh. Fable 5.2 max is the top of the board, at about five times the cost of Grok xhigh for 14 more points.

## Full frontier, cheap to expensive

A row is on the frontier when no other published row is both a higher score and a lower price.

| Model | Effort | Score | $/task |
|---|---|---:|---:|
| GPT-5.6 Luna | low | 16.0% | 0.03 |
| Claude Haiku 5.5 | low | 30.9% | 0.08 |
| Claude Haiku 5.5 | medium | 36.9% | 0.17 |
| Claude Haiku 5.5 | high | 42.3% | 0.32 |
| Claude Haiku 5.5 | xhigh | 44.3% | 0.56 |
| DeepSeek V4.1 Flash | low | 44.9% | 0.60 |
| DeepSeek V4.1 Flash | high | 45.6% | 0.77 |
| DeepSeek V4.1 Flash | medium | 46.3% | 0.80 |
| DeepSeek V4.1 Flash | max | 47.7% | 0.98 |
| Claude Haiku 5.5 | max | 48.4% | 1.12 |
| Claude Sonnet 5.5 | xhigh | 53.1% | 2.81 |
| Claude Fable 5.2 | low | 53.2% | 3.94 |
| Claude Opus 5.5 | high | 56.0% | 3.97 |
| Claude Fable 5.2 | high | 56.9% | 9.70 |
| Claude Opus 5.5 | max | 57.8% | 13.43 |
| Claude Fable 5.2 | max | 60.0% | 32.79 |

Every Grok 4.7 effort sits under that line. The same is true of the GPT-5.6 rows except Luna at the very cheap end, where the score is 16%.

Source table: `BUILD_PLAN.md` Appendix A. The running host still sends Grok until a pool leg exists. The tables below are the ladders to route once that leg can call the model.

## Terminal and shell

Terminal-Bench 4.1, 66 tasks, read from tbench.ai. Cost is the whole run, not one task. A gap inside the published confidence interval is noise. Fable 5.2 max ties Opus 5.5 max at 65.8% and costs about $16.5k against $4.7k, so Fable is not the terminal pick.

| Level | Pick | Resolution | Run cost | Why |
|---|---|---:|---:|---|
| Savings | DeepSeek V4.1 Flash max | 38.5% | $0.2k | Cheapest row that still clears a third of the tasks |
| Balanced | GPT-6.2 Sol max | 61.5% | $0.3k | Near the top of the board at the bottom of the price range |
| Performance | Gemini 4 Carbon high | 64.5% | $1.4k | Best score per thousand dollars above Sol |
| Max | Claude Opus 5.5 max | 65.8% | $4.7k | Ties Fable, costs about a quarter as much |

Copilot Fusion leads at 71.2% for $2.0k. That row is GitHub Copilot, not an API pool model, so it is not on the pool ladder.

## GitHub issue patch

SWE-bench Verified, same harness (mini-SWE-agent v2), is the right board for “fix this issue.” The last apples-to-apples snapshot in hand is the Stanford HAI AI Index, February 2026: Claude Opus 4.5 high at about 76.8%, with Kimi K2.5, GPT-5.2, and Gemini 3 Flash high between 70% and 76%. Those names are older than the November Terminal-Bench and CursorBench rows. Mixing them into one rank would be false precision. Until a same-harness dump for the current names is stored, issue-patch tasks use the CursorBench ladder above.

## Pool coverage of the models these boards watch

The watch list is the families that appear on CursorBench, Terminal-Bench 4.1, or SWE-bench and can be called through an API: Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, Grok 4.7, Gemini 4 Argon, Carbon, and Neon, GPT-5.6 Sol, Terra, and Luna, GPT-6.2 Sol, DeepSeek V4.1 Flash, GLM-5.3, and Kimi K3.1 Pro. Muse Spark 1.3 and Copilot Fusion are on the boards and are not in this count. Score is how many of those 15 a pool listed on 2026-11-26.

| Pool | Listed | Missing from the watch list | Score |
|---|---:|---|---:|
| OpenRouter | 15 | None. Public catalog `GET /api/v1/models` on 2026-11-26, 477 ids, including `meta/muse-spark-1.3` | 100 |
| Venice | 14 | Muse Spark 1.3 by that name | 93 |
| DeepInfra | frontier short | Top measured model is Opus 5, not Fable 5.2 | fails |
| Together, Fireworks, Groq | frontier short | No Claude frontier row | fails |
