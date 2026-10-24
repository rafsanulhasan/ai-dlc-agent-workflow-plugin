# FEAT-20261020-ai-dlc-lens — resume with widened scope: one lens dashboard (savvy-progress + cache-tax + context-view + agent-flow, flowchart view)

## Context
Run `docs/handoffs/FEAT-20261020-ai-dlc-lens/` was paused on 2026-10-20 before anything ran. Its approved plan (`00-approved-plan.md`, option S5) has four parts: a run-state CLI (`workflow.mjs runs`), a gate-alert hook, a per-agent / per-stage cost ledger with a report, and a thin, separate `ai-dlc-lens` mod plugin.

On 2026-10-22 you widened the mod. ai-dlc-lens becomes **one place** that shows what **savvy-progress** and **cache-tax** show, plus run state:
- the agents (by persona name), tokens, context, cost, work progress
- cache warm / cold, cold price, break-even, cold writes

It gets a responsive layout:
- **Narrow panel:** today's savvy-progress row layout.
- **Wide panel:** a flowchart per workflow:
  - one avatar per agent, with its statuses below it
  - arrows from caller to callee, and a two-way arrow inside a loop
  - active agents blinking green; completed agents green and steady
  - run details below the chart
  - one chart per workflow when a session ran several

### Your decisions (2026-10-22)
- **Scope:** *add to* S5; every S5 item stays.
- **Commands:** `/ai-dlc:lens`, `/ai-dlc:lens-init`, `/ai-dlc:lens-configure`.
  - The code lives in the separate ai-dlc-lens plugin.
  - Three thin, Claude-only skills in ai-dlc give the names, the same pattern as `/ai-dlc:keepalive`. Without the lens plugin installed, they tell you how to install it.
  - The Copilot build excludes these skills.
- **Settings:** every setting of both upstream mods is configurable, highest first:
  1. `.claude/settings.local.json` env (always wins)
  2. `.claude/settings.json` env
  3. what you set with `/ai-dlc:lens-init` or `/ai-dlc:lens-configure`
  4. built-in defaults

  Invalid values are ignored, and the process env is not read; both match keep-alive.
- **Avatars:** an initials badge by default, configurable per agent.
- **cache-tax:**
  - Show everything it shows, reading ai-dlc keep-alive's state where that exists.
  - Port the guard as an opt-in setting.
  - Do **not** port its keepwarm: ai-dlc keep-alive already pings, and two keepers would pay twice.
- **Also merge context-view and agent-flow.** All four sources become one view, with **no duplicated field**: each figure appears once, from one source of truth (see *Merged field set*).
- **Look:** clean and good-looking; unnecessary detail is hidden by default and available on demand.
- **Hiding output (agent-flow style, both places):**
  - **Pane:** each agent is one collapsed row or node; `[+]` or a click expands the detail.
  - **Transcript:**
    - Each subagent or teammate call draws as a compact card (avatar, name, status, tokens), replacing the raw prompt and tool noise. This uses the `ToolUse` / `ToolResult` / `ToolGroup` render sites, which work in VS Code.
    - **The subagent's or teammate's actual response (its output text) is never hidden.** Only the call's prompt and tool chatter collapse, and they expand on click.
    - A setting turns the cards off.
    - Only the drawing changes. Nothing is rewritten with `session.append`, so the model still reads everything.
- **Licences:** the upstreams' licence terms go into `THIRD_PARTY_NOTICES.md`:
  - savvy-progress: MIT, johnnyvizz
  - cache-tax: MIT, Karan Bansal
  - context-view: MIT, kongyo2
  - agent-flow: **Apache-2.0**, Charles Tao; its copyright line is still to be confirmed, so research checks NOTICE and the source headers

  The plugin keeps each upstream `LICENSE` (and agent-flow's `NOTICE`, if it has one) and an `ATTRIBUTION.md` that lists every change. Apache-2.0 requires stating changes in modified files.
- **Gates:** you approve all four, G1 to G4, then the release go / no-go.
- **Workspace:** a separate worktree on a branch other than `fix/auto-handoff-chain`.

### Research findings (5 research-assistant reports, 2026-10-22, all `passed`)
**savvy-progress** (JohnnyVizz/claude-kit, MIT, ~1.3k-line `register.tsx`)
- Installed here: 1.2.1, in `~/.claude/plugins/marketplaces/claude-kit/plugins/savvy-progress`.
- Uses `agent.spawn`, `turn.step`, `turn.complete`, a Pane and a band, and `/agents-info`.
- Cost comes from a price table dated 2026-10-10.

**cache-tax** (karanb192/cache-tax, MIT)
- Not installed and not read locally: its size and internals are unknown.
- Terminal and Desktop only; it assumes the 1-hour cache tier.

**Mods API** (early access; it may change between releases)
- A Pane draws in VS Code from 2.1.299.
- Width:
  - `e.props.bodyColumns` and `e.props.placement` (`dock` / `inline`) are available, but there is no resize event.
  - VS Code docks the pane when the panel is 800 px or wider, and draws it inline below that.
  - So **dock + enough columns → flowchart; inline → compact list.**
- **`Svg` draws in VS Code and Desktop only**: the flowchart is an Svg tree, and the terminal always gets the compact list.
- Blinking means toggling a prop from `$.clock.every` plus `$.ui.invalidate` (at most 10 redraws a second). No CSS animation is documented.
- Data sources:
  - `agent.spawn`: `subagentType`, `parentAgentId`, `name`
  - `$.agent.list()`: status and `parentId`
  - `turn.step` / `turn.complete`: usage, including cache read and write
  - `$.session.usage()`: context
  - `session.receive` with `peer-send-message`: agent-team messages
  - `$.fs.read`: `run.md` and `workflow.json`, for stages, `after` edges and loops
- Tests: `claude plugin test`, with `$.ui.mount(... surface: 'vscode')` and an element-tree `find`, plus a mock clock. There are no pixel snapshots.

**context-view** (kongyo2/context-view, MIT; not installed)
- A one-row meter above the prompt: `42% · 84.1k/200k tokens · 82.9k until auto-compact`.
- Warning colour from 60% of the threshold, error colour within the last 20k tokens; `auto-compact next` and `run /compact` hints.
- `/context-view [show|hide]`.
- Data comes from `$.session.usage()`, `session.compact` and `config.set`.

**agent-flow** (Charlie0113-T/claude-agent-flow, Apache-2.0; not installed)
- A pane opened with `/flow`, showing a live tree of the subagents.
- Each row: status, type, name, description, elapsed, current activity, call count, tokens.
- It highlights agents waiting for approval, a tool call over 30 s, and an agent silent for 2 min.
- `[+]` expands the model, prompt excerpt, last lines, recent tool calls and tokens.
- The narrow inline mode shows only rows that need attention; `/flow text` prints the tree as text.
- It does **not** change the transcript.

**Repo**
- A second folder under `plugins/claude/` breaks `build-copilot.mjs` (`:36-41`) and the CI `--check`.
- `plugins/claude-mods/` is being deleted by the fold-cache-keepalive run.
- A run.md parser already exists in `plugins/claude/ai-dlc/hooks/auto-handoff/run.ts` (`parseRunState`, `pickRun`, the Stages table). Reuse or extract it; don't write a second one.
- There are no image assets in the repo.

**Overlap with the fold-cache-keepalive run**
- That run, still active and uncommitted on `fix/auto-handoff-chain`, adds two keep-alive status lines, `/ai-dlc:keepalive` and its `AI_DLC_KEEPALIVE_*` settings.
- Rule: keep-alive keeps its status lines; the lens pane only *reads* its state.
- The lens build waits until that run is merged to `main`.

## Merged field set (each figure once; this is the input to G1 and the spec)
| Area | Field | Taken from | Duplicates dropped |
|---|---|---|---|
| Session header | total tokens, estimated $ (labelled *est.*), elapsed | savvy-progress | — |
| Context | `%` · used / window · headroom to auto-compact, warning and error colours, `/compact` hint | context-view | savvy-progress's session context, cache-tax's context size |
| Cache | warm / cold / unknown, cold re-write price, break-even, session cold writes, guard mode (opt-in) | cache-tax | — |
| Cache | keep-alive state, read from ai-dlc keep-alive and shown only when it is active | ai-dlc keep-alive | cache-tax keepwarm (dropped) |
| Run / workflow | lifecycle, stage, gate, loop round N/M, next action | run.md (S5 core) | — |
| Progress | task bar (title, phase, `Tasks n/m`, %) | savvy-progress | — |
| Agent (collapsed) | avatar, persona name, status, current activity, tokens | agent-flow + savvy-progress | each field once |
| Agent (`[+]` expanded) | type, model, effort, own context %, est. $, elapsed, call count, prompt excerpt, last lines, recent tool calls | agent-flow + savvy-progress | — |
| Attention | waiting for approval, a tool call over 30 s, silent over 2 min, a human gate reached | agent-flow + S5 gate alert | — |

The two $ figures are different quantities, so they are labelled differently: *est. spend* (savvy-progress) and *cold re-write* (cache-tax).

**Default visibility** (hide what isn't needed):
- Collapsed rows and the header are visible.
- Expanded detail, the guard and the price-table date are hidden until asked for.
- The inline pane shows only agents that are running or need attention, plus one summary line, as agent-flow does.

## Workspace
1. On approval, run `git worktree add .worktrees/ai-dlc-lens feat/ai-dlc-lens`:
   - That branch is separate from the current one, holds only the run's docs commits, and was forked from `85915e7`.
   - Then merge `main` (`a802138`) into it, so it has the configurable review limits and current `workflow.mjs`.
2. Every spawn of this run is briefed with the worktree path as its working directory. `fix/auto-handoff-chain` and its in-progress fold run stay untouched.
3. Before the build wave, merge `main` again, after the fold-cache-keepalive PR has landed.

## Execution plan (AI-DLC full lifecycle; mode: full lifecycle traversal; G1–G4 + release go / no-go: human)
Step codes follow the current `handoff` naming. The old `01-…` and `02-…` briefs are marked **superseded**, not deleted.

| Step | Stage | Owner(s) | Output | Gate |
|---|---|---|---|---|
| 3.1–3.5 | research (done in plan mode) | research-assistant ×5 | R1–R5 records and hand-backs, written right after approval | — |
| 4 | work breakdown with the widened scope | Product manager (product-manager) | binding work items and waves, `docs/backlog/backlog.md` | — |
| 5.1–5.n | open technical questions (parallel) | research-assistant | answers, listed below | — |
| 6 | product brief, stories and numbered ACs | product-owner → requirement-analyst; documentation-writer ↔ brutal-critique | `docs/product/ai-dlc-lens*` | **G1** |
| 7.1 / 7.2 | spec and ADRs · low-level design | Mark Richards (software-architect) + Zoran Horvat (system-engineer); brutal-critique | `docs/specs/ai-dlc-lens.spec.md`, ADRs | **G2** |
| 8 | task plan with the 1.0.0 cut line | product-manager | `docs/plans/ai-dlc-lens.tasks.md` | **G3** |
| 9+ | build waves (below), each AAW-style | Boris Cherny (agent-manager) → Kent Beck (sqa-engineer) → Robert C. Martin (code-reviewer) | code and tests | — |
| — | docs | Daniele Procida (documentation-writer) ↔ Linus Torvalds (brutal-critique) | READMEs, recommended-mods page | — |
| — | review | code-reviewer ×2 (standards, spec) | review report | **G4** |
| — | release | product-owner | go / no-go | human |

**Open questions for step 5**, each answered by research-assistant before the spec:
- Can `Svg` do `<animate>` or CSS, `href="data:"` images and hex fills? This decides avatar images and how blinking is drawn.
- Does resizing the VS Code panel re-run `ui.render`?
- Is there a subagent stop event?
- What does cache-tax's source contain: the guard logic, the price table, the settings?
- Do subagent transcripts record the agent type? The ledger history needs this.
- Can mods share state? Can lens read keep-alive's state?
- Do VS Code and Desktop honour `ToolUse` / `ToolResult` replacement the same way, and can a card keep the native result text while hiding the prompt?
- What is agent-flow's real copyright line (NOTICE or source headers)? What is its minimum Claude Code version?
- Read the full source of context-view (meter and readings) and cache-tax: size, price tables, and the minimum version (2.1.287 or 2.1.290).

### Build work items (the product-manager's breakdown is binding; this is the expected shape)
- **WI-4: run-state core.**
  - A shared `runstate` parser, extracted from `hooks/auto-handoff/run.ts` logic so `workflow.mjs` (plain Node, Copilot too) and the lens use one parser.
  - `workflow.mjs runs [--json] [--active]`, with `node:test` fixtures, including run.md files with missing fields.
- **WI-5: gate-alert hook** installed by `init`.
- **WI-6: the `ai-dlc-lens` plugin.**
  - Location decided at G2. `build-copilot.mjs` must ignore it, and CI gets its own validate and test steps, pinned to one Claude Code version.
  - Data model: agents, edges and loops from `agent.spawn` / `$.agent.list` and the run's `workflow.json` stages, plus usage, context and cache figures.
  - **Compact view:** savvy-progress rows (name, type, model, context, tokens, estimated $, elapsed), a progress bar and cache-tax figures.
  - **Flowchart view** (`Svg`, dock + wide):
    - one chart per workflow or run
    - initials-badge avatars, with statuses below
    - caller → callee arrows; a ↔ arrow for a loop
    - active: green and blinking on a timer; done: green and steady
    - the details block below the chart
  - **cache-tax figures** plus the opt-in guard; no keepwarm. **context-view meter**, folded into the header; no separate band in VS Code, which doesn't draw one.
  - **Transcript cards** for subagent and teammate calls (`ToolUse` / `ToolResult` / `ToolGroup`):
    - the prompt and tool chatter collapse behind a click
    - the agent's response text is always shown
    - a setting turns the cards off
    - no `session.append` rewriting
  - **Visual polish:** design guidance from `frontend-design` for the system-engineer's LLD; a single palette that works in light and dark themes.
  - **Text fallback:** `/ai-dlc:lens text` prints the tree as text, as `/flow text` does, for `-p` runs and the terminal.
  - **Settings resolver** with the precedence above. `/ai-dlc:lens-init` and `/ai-dlc:lens-configure` write the user level, with a trust check for any key that names a file path (for example an avatar image), as auto-handoff does.
  - The per-agent / per-stage token ledger and the `/ai-dlc:lens` report view.
  - Dated price tables, with $ marked as an estimate.
  - `claude plugin test` tests: `$.ui.mount` for vscode and terminal, both widths, a mock clock for the blink.
  - Upstream `LICENSE` files, `ATTRIBUTION.md`, `THIRD_PARTY_NOTICES.md` entries with both MIT notices, and marketplace entries (Claude marketplace only).
- **WI-6b: the three thin skills in ai-dlc** (`lens`, `lens-init`, `lens-configure`), marked Claude-only; `build-copilot` excludes them. Changes to the `plugin-management` skill, rules and CLAUDE.md for the new layout.
- **WI-7: docs.** The lens README, a recommended-mods page with the trust warning, and the settings table.

Waves:
1. 3 (records)
2. 4 ∥ 5
3. 6 → G1
4. 7 → G2
5. 8 → G3
6. WI-4
7. WI-5 ∥ WI-6 ∥ WI-6b ∥ WI-7
8. G4
9. release

Loop limits: every loop 2 rounds / 1 failure, and `gate-critique` 2 / 1 (from `rounds --json`; `validate` passed). A stopped loop comes back to you.

## Immediately after approval (my own steps, before any spawn)
1. Create the worktree, merge `main`, and commit nothing else yet.
2. In the run folder:
   - Copy this plan as `00b-approved-plan-2026-10-22.md`.
   - Mark `01` and `02` superseded.
   - Write `3.1`–`3.5` handoff records and store the five research hand-backs verbatim.
3. Update `run.md`:
   - widened scope, decisions, new stages table, `session`, `commit`, `last-record`, *Gates and loops* with limits and source
   - *Next action*: spawn step 4 ∥ step 5.
4. Commit the run state on `feat/ai-dlc-lens`.
5. Save memory: lens decisions (commands via thin skills, settings precedence, no keepwarm, status-line ownership).
6. Spawn product-manager (4) and the step-5 research-assistants in one message. Then run the waves, stopping at G1.

## Verification
- `node .ai-dlc/workflow.mjs validate` passes.
- `node --test "tests/**/*.test.mjs"` covers `runstate` and `workflow.mjs runs`.
- `npx @anthropic-ai/claude-code plugin test` passes for `./plugins/claude/ai-dlc` and for the lens plugin. Both surfaces and both widths are mounted; the blink is checked with the mock clock; the settings precedence is tested level by level, including that invalid values are ignored.
- `plugin validate --strict` passes for ai-dlc, ai-dlc-lens and `.`.
- `node tools/build-copilot.mjs --check` passes, and the Copilot plugin has no lens skills.
- `THIRD_PARTY_NOTICES.md` holds all four notices: MIT for johnnyvizz, Karan Bansal and kongyo2, and Apache-2.0 for agent-flow, with its NOTICE text if there is one. Every upstream `LICENSE` is kept beside the code.
- A field-uniqueness test: no figure renders twice in one pane tree.
- Transcript-card tests: a subagent's response text is present in the mounted tree; the prompt is collapsed; with the setting off, the native rows draw.
- Manual check in the VS Code extension (2.1.299 or later), running a small AAW:
  - a narrow panel shows the compact list
  - widening to dock shows the flowchart
  - an active agent blinks green, and a finished one is steady green
  - a loop shows ↔
  - a second workflow gets its own chart
  - `/ai-dlc:lens`, `-init` and `-configure` work
  - `settings.local.json` overrides `settings.json`
  - subagent calls show as cards in the transcript, with their responses visible
  - collapsed rows expand with `[+]`
