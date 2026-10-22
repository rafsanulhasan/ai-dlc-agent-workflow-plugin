# claude-mods.com: mods that fit the ai-dlc plugin

## Context
You asked which mods on https://claude-mods.com/ would be useful or meaningful for this plugin. This is research only: nothing gets installed or changed. Two research-assistant reports (read 2026-10-20) are the sources:
- **Catalogue:** 277 of the 278 listed mods were read from the grid. Descriptions are paraphrased, and source repos and licences were checked only for blast-radius.
- **Plugin inventory:** the plugin has 15 agents and 60 skills, and ships no hooks, commands, status line, panes or MCP of its own. (True at the time of research. Since then the plugin has one hooks module, auto-handoff, which also registers keep-alive; see *Integration status*.)

## Integration status (updated 2026-10-22)
Two mods from the research have since been built into the `ai-dlc` plugin. Their licence texts are in [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md).

| Mod | Upstream @ commit | Licence | Path in ai-dlc | Command / settings | VS Code |
|---|---|---|---|---|---|
| cache-keepalive | RichardJSun/claude-code-mods @ `6135ec5574609c9fcd865f517c24990d5f37321b` | MIT | `plugins/claude/ai-dlc/hooks/keepalive/` ([ATTRIBUTION.md](../../../plugins/claude/ai-dlc/hooks/keepalive/ATTRIBUTION.md)) | `/ai-dlc:keepalive`; settings from `AI_DLC_KEEPALIVE_*` variables and `.ai-dlc/cache-keepalive.json` | Integrated; confirmed working in VS Code by the maintainer (2026-10-22), status lines included |
| auto-handoff | alexknowshtml/claude-auto-handoff @ `8d762ce726c962268e2dbe24c1c60f0889a2fcde` | MIT | `plugins/claude/ai-dlc/hooks/auto-handoff/` ([ATTRIBUTION.md](../../../plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md)) | Automatic session handoff at a context threshold | Integrated; confirmed working in VS Code by the maintainer (2026-10-22), status lines included |

auto-handoff is the plugin's single hooks module (`hooks/hooks.json` lists only it), and its `register.tsx` also registers keep-alive. Both are Claude-only and are not part of the Copilot plugin. The research findings below about other mods were not re-tested.

**The main gap a mod can fill:** ai-dlc's runtime state exists only as files on disk:
- run state in `docs/handoffs/*/run.md`: stage, gate, loop round N/3, next action
- the hand-back files
- `workflow.json` and the `validate` result

Nothing shows this while a session runs. Gates reach you only as chat messages. OTEL telemetry is turned on in `.claude/settings.json` but nothing reads it.

## What a mod is (limits that affect us)
- **Format:** a mod is a Claude Code plugin with a JS/TS `hooks/register.js` module that runs inside Claude Code (`code.claude.com/docs/en/plugins/mods/overview`).
- **Version:** needs Claude Code CLI 2.1.287 or later.
- **VS Code:** the sources disagreed on whether mods can draw in the VS Code chat panel. The site says no; the official docs say yes from extension 2.1.299. For the two integrated modules this is confirmed by the maintainer on 2026-10-22: auto-handoff and keep-alive work in the VS Code extension, status lines included. The 2.1.299+ requirement is from the official docs; not re-tested.
- **Copilot:** mods are Claude-only and won't reach Copilot. `tools/build-copilot.mjs` drops non-command hooks.
- **Trust:** mods are **not sandboxed** and run with your permissions. Review each one with `claude plugin validate ./<repo>` before installing.

## Shortlist by plugin need

### 1. Seeing the run: stages, subagents, gates (best fit)
| Mod | Why it fits ai-dlc |
|---|---|
| workflow-watch (Alon Baron) | Shows workflow stages with the model and tools in use. Closest to our lifecycle stages |
| flowpane (Mutlu Polatcan) | Run graph and timeline. Fits AI-DLC/FDLC traversal |
| agent-flow / hivemind / agentpane / agent-pulse / savvy-progress | Live subagent tree or cards, some with spend. We fan out 3–15 agents per run |
| mission-control / Flightdeck | Agents, tool calls and files touched; Flightdeck adds permissions and cost |
| plan-progress / telltale / ccprogress | Plan or task progress bars. Could show the STBLC task plan |
| where-am-i / What's Agent Doing | Goal, waiting items and next step: what `run.md`'s *Next action* holds |
| Human in the loop / inbox | Shows the tasks only you can do. Fits the G1–G4 human gates and open clarifications |
| grilling-pane | A pane for plan questions. Fits the Clarify loop and requirement-analyst Q&A |

### 2. Handoff, resume and context survival (matches our `handoff` skill)
| Mod | Why |
|---|---|
| auto-handoff / ctx-handoff / compact-handoff / handoff-compact / compact-keeper | Turn compaction or a context threshold into a handoff brief. Same idea as "runs survive a lost session". **auto-handoff is now integrated** into `ai-dlc` (see *Integration status*) |
| pin-memo / workface | Notes re-shown on resume or after compaction. Could pin the active run.md |
| Sidequest / storybloq | Local kanban or tickets that survive compaction. Overlaps with `docs/backlog`; watch for duplication |

### 3. Quality gates (match sqa-engineer, code-reviewer and brutal-critique)
| Mod | Why |
|---|---|
| verification-ledger (Brad Traversy) | Pass/fail/stale status for test, lint, build and CI. A live view of our quality gates |
| Quality Gate (Eigenwise) | Complexity, tests and CRAP score for edited functions |
| Assertion Guardian | Refuses test edits that drop assertions. Guards against weakened tests |
| catalyst-probes / hope | Model judges on subagent output, or "slop" checks. Same concept as brutal-critique |
| loop-detective / Loop Breaker / loop-guard | Catch repeated failing commands during long agent loops |
| git-gates | Blocks commit/push/merge unless asked. Matches our "commit only when asked" rule |

### 4. Cost and tokens for multi-agent runs
| Mod | Why |
|---|---|
| autotel (Jag Reehal) | OpenTelemetry traces of hooks and tools. OTEL is already turned on in this repo |
| agent-profiler / time-blame | Split time across model, tools and subagents. Shows which stage is expensive |
| context-inspector / session-meter / token-ledger / Observability (Eigenwise) | Context waste, cost and cache ratio |
| agent-router / fable-pin | Choose the model per subagent role. Relevant if agents get model tiers |

### 5. Repo workflow this project already uses
| Mod | Why |
|---|---|
| worktree-map | Lists git worktrees with their state. We put worktrees under `.worktrees/` |
| ci-watch / gh-ci-status | GitHub Actions progress. Shows `validate.yml` without leaving the session |
| pull-request-pane / cc-pr-tracker / change-ledger | PR state and edited files. Useful at G4 review |
| mdview / claude-review | Rendered .md beside the chat. For reading specs, ADRs and handoff records at gates |
| show-me / gfm-render / claude-mermaid | Render Mermaid. `workflow.mjs show --mermaid` outputs Mermaid |

### 6. Safety
blast-radius (Anthropic, Apache-2.0), secret-guard and collision-guard. collision-guard asks before editing a file that another chat changed, which matters when parallel subagents work on the same files.

**Not relevant:** Games and "While you wait" (69 mods), themes and skins, and mods tied to other providers or stacks (Codex/GLM lanes, Xcode, Vercel, WordPress, stock tickers).

## Mods that cover what claude-lens shows
claude-lens v1.3.0 (MIT) is a local browser dashboard. It reads `~/.claude/projects/**/*.jsonl` and serves on port 4128. It shows:
- cost and tokens by session, project, model and branch, with history
- a Cache Lab page
- 5h and 7d window bars, budget and forecast
- context composition
- trends and heatmaps, and an Explore pivot builder

It splits cost only into **main thread vs subagents**. It has **no per-agent breakdown**, so it can't tell you how much code-reviewer cost compared with software-engineer.

| claude-lens view | Closest mod(s) | Gap |
|---|---|---|
| Cost history across sessions, by project and model | **Observability (Eigenwise)**: local HTML board, 90-day history, project filter, model mix, tool failures, uses Claude Code's own cost figure. **taxi-meter**: today, 7 days and total, share by model class | No branch filter, no input/output split |
| Session Detail turn table ($, tokens, cache hit %) | **token-ledger**: one row per turn with fresh input, output, cache reads and writes, hit ratio and cost; subagent turns get their own rows | Current session only |
| Subagent split | **hivemind**, **cctop** (Agents view), **savvy-progress**, **Flightdeck**: cost or tokens *per subagent*, which claude-lens can't do | Live session only, no history |
| Subscription windows, burn rate, budget | **hourglass** (burn rate, time to 100%, toasts), **quota-meter**, **claude-code-usage-quota**, **budget-guard** (cap and blocking) | — |
| Cache Lab | token-ledger / cctop / session-meter (hit ratios), cache-keeper / cache-timer (time left before the cache goes cold; **cache-keepalive**, which keeps the cache warm, is the one now integrated) | No breakdown of why the cache missed |
| Context composition | **context-inspector**, **session-meter** | — |
| Timeline / Gantt | **Flightdeck** (timeline and swimlanes), agent-profiler, time-blame | — |
| A browser dashboard like claude-lens | **Observability** (HTML file), **syzygy** (`localhost:4317`, reads the same transcripts; prices updated by hand) | — |
| Explore pivot, calendar heatmaps, Pareto, CSV export, pricing editor | none | Keep claude-lens for these |

**Suggested set:** Observability for history, token-ledger for per-turn cost and cache, hivemind or cctop for per-subagent cost, and hourglass for limits.

**Caveats:**
- **VS Code:** most of these draw only in the terminal or desktop app. (Update 2026-10-22: the maintainer confirmed that the integrated auto-handoff and keep-alive modules work in the VS Code extension, status lines included. The band above the prompt is still not drawn there. The claims below are from the research and were not re-tested.)
  - Flightdeck panels don't update live in VS Code.
  - agent-profiler and context-inspector record data but draw nothing there.
  - session-hud and taxi-meter don't support VS Code.
  - time-blame shows as a log line.
- **Cost source:** Observability, token-ledger and taxi-meter use Claude Code's own cost figure. hivemind, savvy-progress, token-weather-usage and syzygy estimate cost from price tables, so on a subscription the totals won't match each other.
- **claude-lens pricing:** its default rates on main were placeholders. The `lens-model-pricing` skill fixes them.

**Gap for ai-dlc:** no tool keeps per-agent cost *history* (cost per agent type and lifecycle stage across runs). That would fit naturally in our own ai-dlc mod (step 2 below), using `agentId` / `subagent_type` from the transcripts.

## Build vs buy: feasibility, what-if, cost-benefit, SWOT
Sources:
- research-assistant: the mod API docs, and the code size and licences of 11 open-source mods
- Mark Richards (software-architect): feasibility and what-if
- product-owner: cost-benefit and SWOT

Effort is for one engineer who knows the repo, scaled from the size of comparable mods.

### Options
| | What | Who already offers it |
|---|---|---|
| **A** | Run-state view: lifecycle, stage, pending gate, loop round N/3, next action, validate status, an alert at human gates | Nobody. Only ai-dlc knows its stages and gates |
| **A′** | The same as A, but as a `node .ai-dlc/workflow.mjs runs` command | Nobody. Works for Copilot users too |
| **B** | Tokens and $ per agent type and lifecycle stage, live and over time | **Nobody.** claude-lens splits only main vs subagents; hivemind and Flightdeck show the live session only |
| **C** | Usage limits, cache and context meters | hourglass, token-ledger, session-meter, context-inspector (free) |
| **D** | A history dashboard like claude-lens | claude-lens (MIT, free) |

### Feasibility (software-architect)
| Option | Technically possible? | Main issue | Effort | Upkeep per Claude Code release | Verdict |
|---|---|---|---|---|---|
| A′ CLI | Yes, plain Node reading `run.md` | Some existing run.md files lack fields | 2–3 days | ~0 h | **Feasible, build first** |
| A mod | Yes (`$.fs`, `$.clock`, `$.ui.notify`) | VS Code: pane needs 2.1.299+ and the band above the prompt doesn't draw at all; no Copilot | 4–6 days | 1–3 h | Feasible with conditions |
| B mod | Tokens yes (`turn.complete` gives `agentId` and usage; `agent.spawn` gives the agent type). **Dollars: no per-agent figure from Claude Code** | Needs a maintained price table, because splitting the session total breaks when subagents run in parallel | 10–15 days | 3–6 h plus price updates | Feasible with conditions |
| B′ transcript report | Only if subagent transcripts record the agent type (unconfirmed) | Transcript format is undocumented | 5–8 days | 1–2 h | Depends on that one fact |
| C | Trivial | Duplicates free mods | 3–5 days each | 1–2 h each | Not worth it |
| D | Possible | claude-lens's client alone is ≥30K lines | 60+ days | 4–8 h | Not worth it |

Platform facts behind this:
- The mod API is marked **early access**. It broke at 2.1.271, 2.1.283 and 2.1.299–2.1.304.
- Anthropic can switch mods off remotely.
- All mods share one worker, and three crashes unload every mod.
- Mods are not sandboxed and never reach Copilot.

### What-if scenarios
| Scenario | Build | Upkeep / year (~40 releases) | What it covers | VS Code / Copilot | Risk |
|---|---|---|---|---|---|
| S0 Buy only | 0 | ~10 h | Limits, cache, context. **No run state, no per-agent cost** | depends on each mod / none | Mods are 1–6 weeks old with one maintainer each; token-ledger's repo has no licence |
| S1 A mod only | 4–6 d | 40–120 h | Run state | partial / none | API changes |
| S2 A+B mods, buy the rest | 14–21 d | 160–360 h | Everything but deep history | partial / none | Most exposed to API changes |
| S3 No mods: A′ + B′ + statusLine script | 8–13 d | 20–60 h | Run state everywhere; per-agent cost only if B′ works | full / run state yes | Undocumented transcript format |
| S4 Build everything, including D | 80–100 d | 400+ h | Everything | partial / none | Not affordable for one maintainer |
| **S5 Recommended: A′ core first, then thin A/B mods over it in a separate plugin; buy C; keep claude-lens** | 10–14 d | 60–150 h | Everything | full for run state, partial for live cost | Confined to the separate plugin |

How each scenario holds up if:
- **The mod API breaks again:** S2 and S4 suffer most. S5 loses only its display; the CLI keeps working.
- **VS Code never draws the band above the prompt:** no impact if we design for pane plus status line from day one.
- **Anthropic ships per-agent cost natively:** B keeps only stage and lifecycle attribution, about 30% of its value. Keep it thin enough to delete.
- **Claude Code adds per-turn cost:** the price table goes away and B gets cheaper to maintain.
- **Copilot users need the same features:** only S3 and S5 give them run state. Live per-agent cost isn't possible on Copilot.
- **A bought mod is abandoned:** C is cheap to replace (under 5 days). That's why buying it is fine.

### Cost-benefit (product-owner)
| Option | Value (1–5) | Cost | Verdict |
|---|---|---|---|
| A′ (CLI) | 4: faster gate replies, catch loops before they hit their round limit, easier resume | Low | **Build** |
| B | 5: choose a cheaper model per agent, find runaway loops, cost per lifecycle; a feature nobody else has | Medium–High | **Build after 1.0.0**, as a report first; live view later |
| C | 1 | Low, but no gain | **Buy.** Document the recommended mods; copy no code |
| D | 2 | Very high | **Buy** claude-lens. At most, contribute an "agent type" dimension upstream |

### SWOT: building our own
| Strengths | Weaknesses |
|---|---|
| Only we know the AI-DLC stages, gates, loops and `run.md` format | One maintainer, and 1.0.0 isn't shipped yet |
| Run state is already in files we own, so the CLI is cheap | Mods are Claude-only, which breaks Copilot parity |
| Our own agent team builds and reviews it (AAW) | Claude Code gives cost per session only, so per-agent cost needs a price table |
| MIT-licensed reference mods (Flightdeck, Observability) to learn from | Building it costs model usage |

| Opportunities | Threats |
|---|---|
| Per-agent cost is an open gap and could be a headline feature | Early-access API with frequent breaking changes and a remote kill switch |
| Agent cost data lets us tune the default model per agent | Anthropic may ship per-agent cost natively |
| Gate alerts cut human response time, the slowest part of the lifecycle | Users may refuse mods that aren't sandboxed |
| An upstream contribution to claude-lens gives reach without upkeep | The third-party mods we'd "buy" are young and may be abandoned |

### Where the two reviews agree, and the one difference
- **They agree on:** build A′ first; B is the most valuable item but costs the most; buy C; keep claude-lens for D; don't put mod logic in the `ai-dlc` plugin itself. (Note 2026-10-22: this predates the integration of the auto-handoff and keep-alive hooks modules into `ai-dlc`. It still applies to the lens logic.)
- **They differ on timing of the thin mod:**
  - The architect would ship it now, as a separate `ai-dlc-lens` plugin in the same marketplace. That keeps `ai-dlc` hook-free (as of 2026-10-20; see the note above), out of reach of the kill switch and crash unloading, and lets CI pin the Claude Code version for it alone.
  - The product owner would **defer** mod panes until the mod API leaves early access, or goes 3 or more releases without a breaking change.
  - **This is your call.**

### Recommended order
| # | Item | When |
|---|---|---|
| 1 | Docs: recommended third-party mods, with the trust warning | 1.0.0 (docs only) |
| 2 | A′: a shared parser for `run.md` plus `workflow.mjs runs [--json] [--active]`, tested with `node:test`; a gate alert through a hook installed by init | 1.0.0 if it doesn't delay the release, else 1.1.0 |
| 3 | B: per-agent and per-stage report from a JSONL ledger plus a dated price table | 1.1.0 |
| 4 | `ai-dlc-lens` mod plugin: pane, status line, notify, `/ai-dlc-lens:report`, over the same core | Now (architect) or after the API stabilises (product owner) |
| — | Build C or D | Drop |

When to revisit:
- **Mod panes:** when the API leaves early access, or goes 3 or more releases without breaking.
- **B:** drop it if Anthropic ships per-agent cost natively.
- **D:** revisit if claude-lens is idle for 90 days or rejects the agent-dimension PR.

Open technical questions (for research-assistant before any spec):
1. Do subagent transcripts record the agent type? This decides whether B′ is possible.
2. Does the VS Code extension show a `statusLine`, and which fields does it receive? (Update 2026-10-22: the maintainer confirmed that the integrated auto-handoff and keep-alive modules work in VS Code, status lines included. Keep-alive's status lines come from the mods UI (`$.ui.status`, `plugins/claude/ai-dlc/hooks/keepalive/keepalive.ts:128`), which is not the `statusLine` setting, so the question about the fields a plain `statusLine` receives is still unanswered.)
3. Is `agentId` set on every subagent turn, including agent-team members?

## Your decisions (2026-10-20)
- **Option:** build the CLI and a separate mod plugin now (S5, the architect's option).
- **Release:** in 1.0.0, unless it delays the release. If it would, it moves to 1.1.0, and 1.0.0 gets the docs page only.
- **Cost focus:** both. Start with a report for you as maintainer, then grow it into a feature for plugin users (history and export).

## Execution plan (AI-DLC full lifecycle, entering at Plan)

### Classification
- **Feature.** Most files touched are agent artifacts: `workflow.mjs`, a hook installed by `init`, a new plugin and the marketplace entry.
- **Who writes code:** **agent-manager** writes the code (the hard rule for agent artifacts). sqa-engineer then tests it and code-reviewer reviews it, following the AAW rules.
- **Before any code:** the spec, design and task plan still go through gates G1–G3, because this is a new feature with real design choices.

### Proposed work items
product-manager will produce the binding breakdown and waves after approval.

| ID | Item | Owner chain | Depends on |
|---|---|---|---|
| WI-0 | Answer the 3 open technical questions (agent type in transcripts, statusLine in VS Code, `agentId` coverage incl. agent teams) and confirm `$.process.run` on Windows | research-assistant ×4, in parallel | — |
| WI-1 | Product brief, user stories and numbered ACs for: run-state CLI, gate alert, `ai-dlc-lens` mod (pane, status, notify), per-agent/per-stage ledger and report (maintainer first, user-facing history/export as a later story) → **G1** | product-owner → requirement-analyst; documentation-writer ↔ brutal-critique | WI-0 |
| WI-2 | Frozen spec plus ADRs: (a) mods live in a separate `ai-dlc-lens` plugin; (b) dollars from a dated price table, tokens as the main figure; (c) Copilot gets the CLI only. Low-level design of the shared `runstate` parser, the ledger format (`~/.claude/ai-dlc-lens/<project>.jsonl`) and the pane → **G2** | software-architect + system-engineer (parallel); brutal-critique | WI-1 |
| WI-3 | Task plan with the 1.0.0 cut line (CLI + docs page in 1.0.0; mod in 1.0.0 only if it doesn't delay) → **G3** | product-manager | WI-2 |
| WI-4 | `runstate` core + `workflow.mjs runs [--json] [--active]` + `node:test` tests in `tests/` | agent-manager → sqa-engineer → code-reviewer | WI-3 |
| WI-5 | Gate-alert hook installed by `init` (notify when a run reaches a human gate or becomes `blocked`), with a Copilot twin where possible | agent-manager → sqa-engineer → code-reviewer | WI-4 |
| WI-6 | `plugins/claude/ai-dlc-lens/`: `register.ts` (pane + `$.ui.status` + notify over the core), per-agent ledger, `/ai-dlc-lens:report`, `claude plugin test` tests; marketplace entry (Claude only, not in the Copilot marketplace); a CI job pinned to one Claude Code version | agent-manager → sqa-engineer → code-reviewer | WI-4 |
| WI-7 | Docs: README for ai-dlc-lens, a "Recommended third-party mods" page with the trust warning, and an update to the `plugin-management` skill for the new layout | documentation-writer ↔ brutal-critique (skill change via agent-manager) | WI-4, WI-6 |
| — | Review → **G4**, then release go/no-go by product-owner | code-reviewer ×2 (standards, spec) | WI-4..7 |

**Waves:**
1. WI-0
2. WI-1, then G1
3. WI-2, then G2
4. WI-3, then G3
5. WI-4
6. WI-5, WI-6 and WI-7 in parallel
7. G4

### Constraints the spec must honour
- ~~The `ai-dlc` plugin itself stays hook-free.~~ Superseded on 2026-10-22: the auto-handoff and keep-alive hooks modules were folded into `ai-dlc` (see *Integration status*). Lens logic (run-state view, per-agent cost) still goes in its own `ai-dlc-lens` plugin. `tools/build-copilot.mjs` must ignore `ai-dlc-lens`; for hooks the build projects only the `.hooks` key of `hooks/hooks.json` to Copilot (`tools/build-copilot.mjs:341-343`), and it validates the Claude-only `modules` list without ever projecting it (`tools/build-copilot.mjs:345-357`).
- Design for pane plus status line. Never rely on the band above the prompt, which VS Code doesn't draw.
- The parser must cope with run.md files that lack `current-stage`, `owner`, `session` or `commit`.
- Mark dollar figures as estimates, and date the price table.
- Agents and skills stay language-agnostic.

## Verification
- `node --test` covers the `runstate` parser and `workflow.mjs runs`, including fixtures with missing fields.
- `claude plugin test plugins/claude/ai-dlc-lens` runs in its own CI job, pinned to one Claude Code version.
- `npx @anthropic-ai/claude-code plugin validate --strict` passes for `./plugins/claude/ai-dlc`, `./plugins/claude/ai-dlc-lens` and `.`.
- `node tools/build-copilot.mjs --check` passes, and the Copilot plugin is unchanged apart from the CLI template.
- Manual check:
  1. Install `ai-dlc-lens` locally.
  2. Run a small AAW in the VS Code extension (2.1.299+).
  3. Confirm the pane and status line show the stage, the alert fires at a gate, and `/ai-dlc-lens:report` lists tokens per agent type.
