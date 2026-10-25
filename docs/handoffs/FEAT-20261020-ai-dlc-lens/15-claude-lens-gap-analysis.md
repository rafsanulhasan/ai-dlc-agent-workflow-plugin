# 15 — claude-lens (1.3.0) features missing from ai-dlc-lens, and the human's decisions (2026-10-23)

Built from `15.1-research-assistant-to-orchestrator.handback.md` (claude-lens) and `15.2-research-assistant-to-orchestrator.handback.md` (ai-dlc-lens). Caveat: the claude-lens list comes mostly from its pages spec, which mixes shipped and planned features; saved views and tags are marked planned there and are left out.

| # | claude-lens feature | One-liner | ai-dlc-lens status (before 2026-10-23) |
|---|---|---|---|
| 1 | Subscription window tracker | 5h / 7d limit tracking, leverage and savings stats | excluded (option C) |
| 2 | Burn rate and budget | Month-to-date $, projected month-end, monthly cap and threshold alerts | excluded (option C) |
| 3 | Cache Lab | Hit-rate trend, bust and miss attribution (TTL lapse, prefix change), 5m/1h TTL mix, saved vs uncached | excluded (option D); only live warm/cold figures planned |
| 4 | Trend charts | Calendar heatmap, hour × weekday heatmap, Pareto, rolling efficiency | excluded (option D) |
| 5 | Explore pivot builder | Free choice of measure, dimension, time grain and chart type | excluded (option D) |
| 6 | CSV/JSON export, permalinks | Export any view or copy a link to it | deferred |
| 7 | Pricing table editor | Edit model prices in a settings page | only a `prices` override setting |
| 8 | Observed cost | Real cost captured by Stop-hook / status-line scripts, labelled "observed" | missing (estimates only) |
| 9 | Sessions table | All past sessions, sortable and filterable | missing (current session's runs only) |
| 10 | Session timeline and compare | Gantt of sessions; 2–3 side by side | missing |
| 11 | Prompt full-text search | Search all prompts, jump to the turn | missing |
| 12 | Session detail | Running cost, context sparkline, compaction markers, cost per turn (main vs subagents) | partial (live meter, per-agent totals, no history) |
| 13 | Turn Inspector | API-call waterfall, cache story per call, transcript peek | missing |
| 14 | Tool mix and tool timeline | Which tools ran, how often, when | missing |
| 15 | Projects page | Spend by project and branch, week-over-week growth | missing |
| 16 | Models page | Model mix over time, version comparison, entrypoint split | missing |
| 17 | Leaderboards and anomaly feed | Top sessions/projects/models; unusual spend and failed gates | partial (gate alert only) |
| 18 | Data health page | Dedup and parse errors, scan coverage, unpriced models | partial (unpriced model shows `—`) |
| 19 | Global filters and drill-down | Date, project, model, branch, host filters; units; previous-period compare; click-through | missing |
| 20 | Several scan folders | Scan folders beyond `~/.claude/projects`, labelled by machine | missing |
| 21 | Standalone web server | One `npx` command, live browser dashboard, CLI and port flags | different by design (panel in Claude Code) |

## Human decisions, 2026-10-23
1. **Scope:** add the live-session gaps **and** reopen options C and D. This changes the scope approved at G1; the brief and stories go back through PDLC and G1 is approved again before G2.
2. **Spike 027 feedback** (the lens card now shows in the chat, but not as expected) — binding for the spike rework:
   - Orchestrator transcript: how it thought and gathered context; thinking collapsible, gathered context collapsible.
   - Workflow at the top: flowchart of the orchestrator spawning agents, an avatar per agent.
   - Under each avatar: `Agent Name (model)` e.g. `Agent Manager (opus/opus-5.5)`; role e.g. `agent-manager`; context used / window e.g. `100K/1M`; input / output tokens e.g. `100K, 200K`; cache reads / writes / misses.
   - Click an arrow: separate panel with that handoff and hand-back, and its input / output tokens.
   - Click an avatar: separate panel with that agent's background tasks and tool calls.
3. **Order:** work on the spike first; the scope pass follows and uses the spike's result.
