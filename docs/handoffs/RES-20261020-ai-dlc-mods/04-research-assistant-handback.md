# Hand-back 04: research-assistant — cluster D-observability-panes

Stored verbatim on 2026-10-20 (work item RES-20261020-ai-dlc-mods).

---

# Research Findings: context/cost observability and workflow-progress mods (cluster D)

None of the nine mods is a VS Code mod, and none knows AI-DLC stages, gates or handoffs. The VS Code extension can draw mod panes and status lines (extension 2.1.299 or later), but none of these mods claims it. agent-flow is the only one that mentions VS Code, and there it falls back to a text report. Per-subagent tokens and agent type can be read today from transcripts and from mod events.

## Per-mod table

All facts are from each mod's claude-mods.com page, fetched 2026-10-20. Every mod needs Claude Code 2.1.287 or later. "Tested" is the author's own statement.

| Mod | What it does | How it works | Where it runs | Licence / source | Maturity |
|---|---|---|---|---|---|
| context-bar (Hamza Zafar) | Stacked context bar above the prompt: tokens by category, % badge (yellow at 70%, red at 90% of the way to compaction). **Skips subagent turns** | Band above the prompt; mod events (`turn.complete`, `session.compact`, `ui.render`) plus Claude Code's own `/context` breakdown | Terminal, desktop. VS Code not listed | MIT, github.com/hamzafer/claude-code-mods | 303★ (shared repo), Oct 6. Tested: not stated |
| context-lens (Arunjay) | Line under the prompt: window fill, last turn's delta, turns left before auto-compact. `/context-lens` pane by category. **Skips subagents** | Pinned line plus pane; `$.session.usage` | "Interactive terminal sessions" only | MIT (README only, no LICENSE file), github.com/Arunjay4213/claude-mods | 9★. Tested 2.1.269 |
| claude-code-figures (natsukium) | **Off topic.** Draws Mermaid, Graphviz, D2, SVG and LaTeX as images. Could later draw a workflow diagram | `ui.render` plus local renderers via `process.run` | Terminal with kitty or Ghostty only | Apache-2.0, github.com/natsukium/claude-code-figures-plugin | 10★. Tested 2.1.287 |
| mission-control (Hamza Zafar) | `/mission` pane. "Who" view: main agent, each subagent with running time and tool count, each tool call. "Code" view: map of touched files. Band shows running agents. **No tokens** | Pane plus band; `agent.spawn`, `tool.call`, `turn.start`. Code view needs macOS and Chrome | Terminal, desktop | MIT, hamzafer/claude-code-mods | Oct 6. Tested: not stated |
| agent-flow (Charles Tao) | `/flow` live tree, one row per agent: status, type, name, elapsed time, current tool, pending approval, **tokens in/out per agent once it finishes** | Pane; engine events plus `$.agent.list()` every 2 s | Terminal. **"In `claude -p` and the VS Code extension, `/flow` prints the tree as text"** | Apache-2.0, github.com/Charlie0113-T/claude-agent-flow | 22★, Oct 2. Tested: not stated |
| flowpane (Mutlu Polatcan) | Graph or timeline of a **Workflow-tool run**: a node per agent with state, time, **spend** and model, plus run totals | Pane; tails the run's `journal.jsonl` and `*.meta.json`; `turn.step` usage. Needs `/tui fullscreen` | Terminal only. **Workflow runs only, not standalone subagents** | MIT, github.com/mpolatcan/flowpane | v0.10.0, 11★. Tested 2.1.272 |
| workflow-watch (Alon Baron) | Stage list of a **Workflow-tool run**: model, effort, **output tokens per stage**, current tool; toast when a stage finishes | Pane, band, status line, toast. Reads `subagents/workflows/` files every 2 s (`journal.jsonl`, `agent-<id>.meta.json`, `agent-<id>.jsonl`). The page warns this folder layout is internal to Claude Code | Terminal, desktop. VS Code not mentioned. Needs a 144-column terminal | MIT, github.com/alonbaron/claude-skills | v0.1.0, 13★, Oct 16 |
| agentpane (Anji Xu) | Side pane listing every subagent: tool, time, model, **input tokens with cached share, output tokens, context size, request count**; Stop button; batch timeline | Pane (docks only in fullscreen); `agent.spawn`, `agent.list` polled every 1 s, `turn.step` usage | Terminal. Desktop: no auto-open, toast or status line. VS Code not mentioned. "Workflow agents are not individually identifiable" | MIT, github.com/xuanji86/claude-agentpane | 12★. Tested 2.1.288 |
| workface (Scott Hodge) | **Belongs in the handoff/compaction cluster, not here.** Keeps per-tranche notes and re-inserts them after compaction; `/workface` panel | Compaction hooks plus an MCP tool; files under `~/.claude/workface/` | Terminal. Main session only. "Says nothing about native Windows" | MIT, github.com/scodge-24/workface | 5★. Tested 2.1.287 |

**What a mod pane is, and VS Code.** A mod is a plugin with a hooks module. A `ui.render` hook returns an element tree for a render site (pane, band, status line, toast and others) (https://code.claude.com/docs/en/plugins/mods/interface). In the VS Code extension:
- Mod drawings appear in the chat panel "with extension version 2.1.299 or later". Sessions that don't fetch feature flags, such as Bedrock, need 2.1.304 (same page, "Draw in the VS Code extension").
- `Pane`, `Spinner`, `AskUserQuestion` and the message and tool sites "work in the terminal, the Desktop app, and the VS Code extension".
- Panes dock beside the chat when the panel is 800 px or wider; narrower, they sit above the prompt and show 12 rows.
- Status lines are cut at 200 characters or 2 rows, and are hidden while a permission request or dialog shows.
- Buttons have no hotkeys. `Svg` renders in desktop and VS Code but not in the terminal.

So VS Code support depends on what each author built. A mod written to these rules can draw in VS Code, but none of the nine says it does.

## Where per-subagent tokens can be read (checked locally and in the docs)

1. **Subagent transcripts.** Each subagent writes `~/.claude/projects/<proj>/<session>/subagents/agent-<id>.jsonl` with `isSidechain:true`, `agentId` and `sessionId`. Each assistant line has `message.usage` with `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens` and `output_tokens_details.thinking_tokens`.
   - Source: `C:\Users\rafsa\.claude\projects\e--Projects-personal-ai-dlc-agent-workflow-plugin\98fc8950-941e-4001-9bb1-8a0983c76010\subagents\agent-a2c9a498143ab26b5.jsonl:1,15`.
   - **Pitfall:** lines 15 and 16 carry identical usage. Streamed parts of one message repeat it, so dedupe by message id before summing. This is my inference from the duplicate rows.
2. **The agent type is recorded.** `agent-<id>.meta.json` holds `{"agentType":"ai-dlc:research-assistant", "description", "toolUseId", "spawnDepth", "requestShape"}` (`…\subagents\agent-a2c9a498143ab26b5.meta.json:1`). This answers WI-0 question 1 with **yes**, from a local build only. The format is undocumented and may change.
3. **Mod events.** `turn.step` gives `result.usage` for each request, with `e.agentId` set on subagent requests. `turn.complete` gives `e.usage` per turn, also with `agentId` (https://code.claude.com/docs/en/plugins/mods/events, "Follow a turn"). `agent.spawn` gives `subagentType` and `parentAgentId` (02-orchestrator-to-research-assistant.md:31-32). There is no dollar figure per agent, only session cost (same file, :30).
4. **Settings hooks.** `classic.Stop` and the like give `transcript_path` (events page, "Handle the settings hook events"). That is usable from a plain hook, with no mod needed.

## Overlap with the paused ai-dlc-lens plan

- **A (run-state view) and B (per-agent and per-stage tokens, with history)** in `00-approved-plan.md:128-129` are still uncovered.
  - agent-flow and agentpane give live tokens per subagent but no `run.md`, stage, gate or history.
  - flowpane and workflow-watch know only the Workflow tool's `journal.jsonl`. ai-dlc runs are orchestrator spawns, not Workflow-tool runs, so neither will show an ai-dlc chain. That conclusion is an inference from their stated data sources.
- **C (context and cache meters)** is "buy" in the plan (`00-approved-plan.md:131,173`). context-bar and context-lens cover it for the main thread only and skip subagents.
- Item 2 above settles the plan's open question 1 (`00-approved-plan.md:213`) for B′, the transcript report: yes, `agentType` is in `meta.json`.

## Per requirement

**R5: unified context bar (context meter, cache meter, context waste) at each scope**

| Scope | Covered by | Gap | Feasibility |
|---|---|---|---|
| Session, main thread | context-bar, context-lens (fill and categories). Cache: agentpane shows cached share per agent | No single bar with context, cache and waste together. No "waste" metric anywhere in these nine (context-inspector in the plan's catalogue is a candidate, unverified here) | High: `$.session.usage` plus `turn.step` usage |
| Per agent | agentpane (context size, cached share), agent-flow (tokens in/out) | No per-agent context meter in a bar. Both skip VS Code | High in a mod (`turn.step` plus `e.agentId`) |
| Project-wide / all sessions | None of the nine (claude-lens covers history, per the plan) | Mods are tied to one session | Medium: a mod's own ledger, or the B′ transcript scan over `~/.claude/projects/**`. Whether mods can read outside the project through `$.fs` is **unverified** |

**Recommendation for R5:** build it inside ai-dlc-lens as one status line plus a pane, reusing the context-bar and agentpane ideas. Do not integrate those mods: they skip subagents and don't claim VS Code. Treat "waste" as a metric we define ourselves. One candidate is cache creation tokens that are never read back, or tokens added before a compaction. That definition is a design decision, not something the sources give.

**R10: work-progress pane during an ai-dlc chain**

| Need | Covered by | Gap |
|---|---|---|
| Workflow diagram (like the deck) | flowpane and workflow-watch draw graphs, but only for Workflow-tool runs. figures renders Mermaid in kitty or Ghostty only | No mod reads `workflow.json` or `run.md`. `workflow.mjs show --mermaid` exists, and `Svg` renders in VS Code |
| What each agent is doing | mission-control, agent-flow, agentpane | No mapping to AI-DLC stages, gates or loop rounds |
| Tokens per agent | agent-flow, agentpane, flowpane (live session only) | No mapping to agent type or stage, and no history |
| Handoffs | None | Only ai-dlc knows `docs/handoffs/<wi>/NN-*.md` |
| A button to open the pane | Any mod: a `$.ui.open` command, or a button in a pane or toast | Works in VS Code from 2.1.299 |

**Recommendation for R10:** build it as the ai-dlc-lens pane (plan item 4 plus option A), reusing agentpane's event model (`agent.spawn`, `turn.step`) and flowpane's graph layout idea. Join `agentId` to `subagentType` to `run.md` stage. For the diagram, draw an `Svg` from `workflow.json` in VS Code and desktop, with a text or box tree in the terminal. Do not integrate any of the nine, because none sees ai-dlc runs.

**Reference only:** `Claude outputs/AI-DLC-in-Practice.pptx` exists (not parsed). Treat it as the visual reference for the workflow pane.

## Confidence and open questions

- **Medium–High overall.** The mod facts come from single directory pages, unverified against each repo. The VS Code facts come from the official docs. The transcript facts come from one local build.
- **Unverified:**
  - whether any of the nine actually renders in VS Code (none claims it)
  - whether `$.fs` can read `~/.claude/projects` across sessions
  - whether `meta.json` and `agentType` are stable across versions
  - whether `agentId` is present for agent-team teammates and `SendMessage`-resumed agents (WI-0 question 3 is still open)
- **Open:** "context waste" has no agreed definition; the product owner needs to define it at G1.

Nothing was edited. I skipped the memory load (MEMORY.md was empty) and saved no memory, because plan mode allows no file writes.
