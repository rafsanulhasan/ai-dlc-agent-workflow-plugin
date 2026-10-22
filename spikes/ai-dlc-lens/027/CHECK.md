# ITEM-027 spike (a): manual check in VS Code

Throwaway mod plugin `ai-dlc-lens-spike-027`. It is not plugin source: it is deleted before the lens PR leaves draft. The software-architect cites the results in the spec (ITEM-005).

Round 1 (step 17, 2026-10-23) reworks the spike to the lens card the human described on 2026-10-23 (`docs/handoffs/FEAT-20261020-ai-dlc-lens/15-claude-lens-gap-analysis.md`, "Human decisions" 2), following the layout and fallbacks of step 16 (`16-research-assistant-to-orchestrator.handback.md`). `/spike027` now opens the lens card. The round-0 kit (resize, Svg blink, buttons, transcript cards, gate alert) is still there, as `/spike027-kit`, checks K1 to K5 below.

`<REPO>` is the main checkout of this repository, the folder registered as the `ai-dlc-agent-workflow` marketplace (`CLAUDE.md`), switched to the `feat/ai-dlc-lens` branch. `<SPIKES>` = `<REPO>\spikes\ai-dlc-lens`; `<SPIKE>` = `<SPIKES>\027`, this plugin.

## What was checked automatically (2026-10-23, Claude Code 2.1.309)

- `claude plugin validate <SPIKE>`: passed, one directory warning (no icon). The module hooks `session.start`, four `command.run`, `agent.spawn`, `turn.start`, `turn.step`, `tool.call`, `turn.complete`, `ui.render` for six panes (`lens-027`, `lens-027-edge`, `lens-027-agent`, the probe panes, `lens-spike-027`), `ToolUse` and `ToolResult`, `classic.SubagentStop` and `classic.Stop`.
- `npx -p typescript@5 tsc -p <SPIKE>\.tsc` with the 2.1.309 `claude-code.d.ts`: no errors.
- `claude plugin test <SPIKE>`: 16 passed, 0 failed (`tests/spike.test.tsx`). The tests check the trees the hooks return: the five lines under each avatar, one Button per avatar and per arrow with unique keys, the hand-off and agent panes opening, drill-in with Back, the collapsible sections, the two-way arrow, the background tasks, and the probe log. The test kit draws nothing, so every check below still needs a person to look at VS Code.
- Two headless runs, `claude -p --setting-sources user --plugin-dir <SPIKE> --input-format stream-json --output-format stream-json --verbose`, from `<REPO>`, with `/spike027-probe on` as the first message. Their logs are not committed. What they showed:
  - E1: the Agent call's input keys are `subagent_type`, `description`, `prompt`, `run_in_background`; `agent.spawn` has the brief as `prompt`. The Agent call's result also carries `usage`, `totalTokens` and `resolvedModel`.
  - E2: thinking chunks arrive, but with empty text (2 chunks, 0 characters), and the stored transcript's thinking block has 0 characters too. The observer took 0 to 1 ms per step.
  - E4: an agent the main loop spawned is listed with no `parentId`, status `running`.
  - E5: for a subagent and for main, `turn.complete` usage equals the sum of its `turn.step` usage exactly. The transcript rows (`$.session.messages`) carry no usage.
  - E6: `$.session.usage().context.window` was 1,000,000 on main. No API gives a subagent's window.
  - E7: a background Bash call's result carries `backgroundTaskId`; `$.agent.list()` does not list the shell; the next `classic.Stop` lists it in `background_tasks` (`running`), and the Stop after it finished lists nothing.
  - E8: `$.fs.read` read a handoff record on Windows with all four path forms: relative with `/`, relative with `\`, and absolute with either separator.

## Install (VS Code, Claude Code 2.1.299 or later)

Main route: the repository's own marketplace, `ai-dlc-agent-workflow`, read from `<REPO>`, which must be on `feat/ai-dlc-lens`.

1. In a terminal at `<REPO>`: `claude plugin marketplace update ai-dlc-agent-workflow`, then `claude plugin install ai-dlc-lens-spike-027@ai-dlc-agent-workflow --scope local`.
2. Run `/reload-plugins` in an open Claude Code session, or open a new one in VS Code.
3. Type `/spike027`. The pane "AI-DLC lens (spike 027)" opens.

The installed copy does not follow edits under `<SPIKE>`. If you installed round 0, uninstall and install it again (the version stays `0.1.0`), then `/reload-plugins`.

Terminal: `claude --plugin-dir "<SPIKE>"` loads the folder for that session only, with nothing installed.

Alternative, only if the marketplace route fails: the plugin folder variable. You set it and you remove it; nothing is installed.

1. Add `"CLAUDE_CODE_PLUGIN_DIRS": "<SPIKE>"` to the `env` block of `~/.claude/settings.json`, with each `\` written as `\\` (user settings only; project settings are not read for it).
2. Quit VS Code, start it again, and open a new Claude Code session. Type `/spike027`.
3. Afterwards, remove the entry.

If any hook fails, VS Code shows a dim transcript line `ai-dlc-lens-spike-027: ...`, and the lens pane shows a red `lens hook error:` line at its foot. Copy either into the result.

## Teardown

```text
claude plugin uninstall ai-dlc-lens-spike-027@ai-dlc-agent-workflow --scope local
```

Keep the `ai-dlc-agent-workflow` marketplace; it also serves `ai-dlc`. If you used the alternative, remove the `CLAUDE_CODE_PLUGIN_DIRS` entry.

## Setup for the round 1 checks

The card shows what happens in the session after the plugin loaded. So:

1. Open a new session with the orchestrator (`"agent": "ai-dlc:orchestrator"` is already set in this repository's settings), then type `/spike027` and `/spike027-probe on`.
2. Send a request that spawns several agents, for example: `Spawn two research-assistant agents in parallel: one lists the agents in plugins/claude/ai-dlc/agents, one lists the skills in plugins/claude/ai-dlc/skills. Then spawn an Explore agent that counts the files in spikes/ai-dlc-lens. Then reply DONE.` To see a record matched to an arrow, use a request the orchestrator records, or put a record path on the brief's first line yourself (L4).
3. Leave the lens pane open while the turn runs.

The probe log is `<SPIKE>\PROBE-LOG.jsonl` when the session runs in `<REPO>` (the `/spike027-probe on` reply names the file). It is not committed.

## Round 1 manual checks: the lens card

Write the outcome of each check (works, does not work, or partly works) in its Result column, with a screenshot or the line you saw. Note the VS Code extension version.

| # | Design item | Steps | What you should see | Result |
| --- | --- | --- | --- | --- |
| L1 | 1. How the orchestrator thought and gathered context: thinking collapsible, gathered context collapsible | Under "Orchestrator (main loop)", press `[+]` beside "Thinking", then beside "Gathered context". Press each again. | Each section opens and closes; the label switches `[+]`/`[-]`. "Gathered context (N calls)" lists the main loop's Read, Grep, Glob, Web, Bash, Skill and Agent calls, `...` while running, `ok` or `ERR` after. Thinking shows the main loop's thinking text, or, where the stream carries none (as in the headless runs), one line `[no thinking text: N block(s) streamed empty; transcript holds M thinking block(s) with K chars, R redacted]`. This is a pane section: the transcript has no place to draw thinking (fallback, step 16 Q1). | |
| L2 | 2. Workflow at the top: flowchart of the orchestrator spawning agents, an avatar per agent | Watch the top of the pane while the request in *Setup* runs. | One round avatar with initials per agent: the orchestrator on top, each spawned agent one level below its spawner, an arrow from spawner to each. Two research-assistants show as two avatars. Under the chart: a row "Avatars:" with one Button per agent and a row "Arrows:" with one Button per arrow (the chart itself cannot take clicks, step 16 Q2). Record whether the chart fits the pane width or overflows. | |
| L3 | 3. Under each avatar: name (model), role, context used / window, input / output, cache read / write / misses | Read the lines under each avatar in the chart and in the bordered box per agent below the Buttons. | Five lines per agent, for example `Agent Manager (opus/opus-5.5)`, `agent-manager`, `ctx 300K/1M`, `in 100K, out 200K`, `cache r 90K / w 9K / uncached 1K`. `in` counts all input (uncached + cache read + cache write). "uncached" stands for misses: it is `input_tokens`, derived, labelled at the pane's foot. A subagent's window is main's when it runs main's model, 1M for a `[1m]` model, else 200K marked `(window assumed)`. The orchestrator's role reads `orchestrator (main)`. Figures grow during the turn. | |
| L4 | 4. Click an arrow: separate panel with that handoff and hand-back, and its input / output tokens | Press an arrow Button (`17 Orchestrator -> Agent Manager`). | A second pane opens as a tab, titled `Hand-off: ...`: the hand-off's tokens (`in`, `out`, cache r / w / uncached, from the callee's `turn.complete`), the step sums beside them, `Record matched: first line`, `body` or `fallback`, then the handoff record text and the hand-back text, each with its own `[+]`/`[-]`. An agent whose brief names no record shows `fallback` (the newest `*-to-<role>.handoff.md` from before the spawn: check it is the right one) or the red line "No handoff record". | |
| L4b | 4, fallback | Press `drill-in` beside "Panels:", then an arrow Button. Press `< Back`. | The same content inside the lens pane, with `< Back` on top; Back returns to the flowchart. Use this if L4's second pane does not open or is hard to use. | |
| L5 | 5. Click an avatar: separate panel with that agent's background tasks and tool calls | Press an avatar Button, while the agent runs and after it finished. Press `Refresh`. Press `View transcript`. Press `[+]` beside "Thinking". | A pane `Agent: <name>` opens as a tab: name (model), role, status, context; "Background tasks" (its running children from `$.agent.list()`, and stop-time `background_tasks`, each marked with its source); "Tool calls" with `...`/`ok`/`ERR`, tool and target, and `step out X / N calls (est.)` (a step's output split over its calls is an estimate, step 16 Q5); its thinking, collapsible. `View transcript` switches the main view to that agent's transcript (pressing it on the orchestrator returns to the main one). | |
| L6 | 6. Responses never hidden; two-way arrow for a loop; running agents blink green, finished ones green without blinking | Watch the avatars while agents run and after. Make the orchestrator send a `SendMessage` to a running agent, or spawn the same agent type again from the same spawner. Expand an Agent row in the transcript. | Running avatars fade in and out about once a second; finished ones stay solid green; failed or killed ones red; waiting ones amber. The arrow to an agent messaged again or respawned gets an arrowhead at both ends and its Button reads `<->`. In the transcript each Agent row sits inside its `LENS CARD` with the native row and the subagent's full response unchanged (as in K4). | |

## Round 1 experiments (E1 to E8, step 16)

Run with `/spike027-probe on`. Each writes JSON lines to `PROBE-LOG.jsonl`, `exp` naming the experiment. Copy the lines that answer the question into the Result column, or attach the file.

| # | Question | Steps | What you should see | Result |
| --- | --- | --- | --- | --- |
| E1 | Which key holds the brief, and is the record path its first line? | Run the *Setup* request. | `E1` lines from `agent.spawn` (`keys`, `firstLine`, `match`) and from `tool.call` (`tool`, `inputKeys`, `hasPrompt`, `firstLine`). Headless: the key is `prompt`. In an orchestrator run, `match.how` should be `first line` for every recorded hand-off. | |
| E2 | Do thinking chunks arrive, with text, for main and a subagent; what does the observer cost? | Run the *Setup* request with the orchestrator on a thinking model. | `E2` lines per step: `counts.thinking`, `thinkingChars`, `observeMs`; and one `turn.complete stored thinking` line per turn. Record whether `thinkingChars` is above 0 in VS Code (it was 0 headless). | |
| E3 | How many panes open as tabs; do drill-in and Buttons under an Svg work? | `/spike027-probe panes 8`, then `/spike027-probe panes 16`. Look at the tabs. Press "Close all probe panes". Then L4 and L4b. | The reply says how many opened; the `E3` line lists each `isPlaced` and what `$.ui.panes()` returned. Record the largest number of tabs VS Code shows and whether they can be switched. | |
| E4 | `$.agent.list()`: `parentId`, status moves, teammates | Run the *Setup* request; for a teammate, ask for an agent team. `/spike027-probe list` at any time. | `E4` lines each time a listed status changes (checked every 2 s while probes are on): `id`, `type`, `status`, `was`, `parentId`, `teammateId`. Record whether a teammate is listed and how its status moves. | |
| E5 | Do per-agent sums match? | Run the *Setup* request. | `E5` lines per finished turn: `turnUsage`, `turnsSum`, `stepsSum` (equal headless), and `rows` (usage found in the agent's transcript rows: none headless). | |
| E6 | The window of main and of a subagent | `/spike027-probe usage`, after a subagent on another model ran (for example ask for an Explore agent with `model: haiku`). | The reply and an `E6` line: main's `context.window`, and each agent's model. No subagent window: the card uses the table in L3. | |
| E7 | Are live background shells listed anywhere? | Ask: `Start sleep 30 with Bash in the background and reply STARTED.` Open the orchestrator's avatar panel at once, again after 30 s and after the next turn. | The panel lists `running shell sleep 30 [tool.call]` at once (from the call's `backgroundTaskId`), then the stop-time entry, then `ended`. `E7` lines: the call, `$.agent.list()` after it (no shell there headless), and `background_tasks` at each Stop. | |
| E8 | `$.fs.read` of a handoff record on Windows, by path form | `/spike027-probe fs docs/handoffs/FEAT-20261020-ai-dlc-lens/17-orchestrator-to-agent-manager.handoff.md`. Then press an arrow (L4). | The reply lists four tries (`/`, `\`, absolute with either), each `ok: true` with the same `chars`. The arrow press adds an `E8` line with `ok` and the hand-back found. | |

## Round 0 kit checks (`/spike027-kit`)

Type `/spike027-kit`. The pane "Lens spike 027 kit" opens. These are the round-0 checks, unchanged; earlier results still stand.

### K1. Resize across the dock boundary (AC-12.10)

Steps:

1. Open the kit pane with `/spike027-kit`.
2. Drag the Claude Code panel from narrow (about 500 px) to wide (more than 1000 px), then back, crossing 800 px each time.
3. Each time, read section [1].

Expected: `placement` switches between `inline` and `dock`. The drawing switches between `COMPACT` and `FLOWCHART`. Each resize adds a line to the redraw log, with the new `bodyColumns`. The width is shown in cells: VS Code gives the pane no pixel width.

What each outcome means:

- **Works:** the pane redraws by itself when its width changes. The design can switch between compact and flowchart from `placement` and `bodyColumns`.
- **Does not work** (no new log line, or `placement` stays the same until something else redraws): the design falls back to a user toggle. Press `auto`, `compact` and `flowchart` and check that each one redraws at once; that toggle is the fallback.
- **Partly works** (the pane redraws only on some resizes, or `placement` changes but `bodyColumns` does not): record which.

### K2. Svg animation

Steps: watch section [2] for 10 seconds.

Expected:

- A (SMIL, `isInteractive`) fades in and out about once a second.
- B (timer) switches between green and grey twice a second.
- C stays green.
- D (text) switches between `●` and `○`.

What each outcome means:

- **A blinks:** the blink can be SMIL, with no timer. The lens card's avatars (L6) use this.
- **Only B blinks:** use the timer path, `$.clock.every`. Redraws are throttled to 10 per second.
- **Neither blinks, or C is not green:** Svg is not usable in VS Code. Use Text glyphs (D). Record whether D blinks.

### K3. Buttons

Steps:

1. In section [3], click `[+]`. Click it again.
2. Run K4 to get a card in the transcript, then click the card's `[+]`.

Expected: the label switches between `[+]` and `[-]` and `presses=` goes up by one on every click. In the pane, "expanded content..." appears and disappears. On the card, "input keys: ..." appears and disappears.

What each outcome means:

- **Pane and row both work:** expand and collapse are possible in both places.
- **Pane only:** cards cannot expand. Show the details in the pane instead.
- **Neither works:** use the keyboard: Tab to the button, then Enter. Record whether that works.

### K4. Transcript cards (the native response is never hidden)

Steps:

1. In the session, type: `Use the Explore agent to list the files in the hooks folder of this plugin, then reply DONE.`
2. Optional, for teammates: run a prompt that makes Claude use `SendMessage`.

Expected: the `Agent` call row is drawn inside a rounded card that starts `LENS CARD Agent -> <type> (running)` and changes to `(done)`. The native row is inside the card, below the header. The subagent's result row under it is unchanged. The full response is still visible after expanding with ctrl+o, or the native expand in VS Code. Section [4] of the kit pane counts the cards drawn and the ToolResult rows passed through.

What each outcome means:

- **Works:** cards can be drawn at `ToolUse` with the native row nested, and `next(e)` at `ToolResult` keeps the response.
- **The card shows but the native row or the response is missing:** blocker. The design must not replace the row. Use a header drawn above the row without nesting, or a pane-only view.
- **No card** (VS Code draws its own row): VS Code does not take rewrites at this site. Record any "From the ... plugin" or "Edited by the ... plugin" label you see.

### K5. Gate alert: `Stop` hook `systemMessage` (A14)

Steps:

1. Type `/spike027-gate on`. This writes `on` to `GATE-ALERT.txt` in the folder the plugin was loaded from: Claude Code's installed copy for the marketplace route, `<SPIKE>` for `--plugin-dir`. The reply names the exact file. With no file, the marker is `off`.
2. Send any prompt, for example `Reply OK`, and let the turn end.
3. Type `/spike027-gate off`, send another prompt, and check that the alert no longer appears.
4. Repeat steps 1 to 3 in the terminal: `claude --plugin-dir "<SPIKE>"`.

Expected in each place:

- 5a, from the command `Stop` hook: a notice "ai-dlc-lens spike: gate alert test (5a, command Stop hook systemMessage)", which the headless stream labels `Stop says:`.
- 5b, for comparison: a toast "... (5b, module toast on classic.Stop)".

What each outcome means:

- **5a is shown in VS Code and in the terminal:** the gate alert can stay on `systemMessage`, as decided.
- **5a is shown only in the terminal, or nowhere, and 5b is shown:** move the alert to the module, using `$.ui.toast` on `classic.Stop` (or `$.ui.notify`).
- **Neither is shown:** the alert has to come from the pane itself, as a state change drawn in the lens.

## Files

- `.claude-plugin/plugin.json`: the manifest. Its marketplace entry is in `<REPO>\.claude-plugin\marketplace.json`, with the other three spike plugins and `ai-dlc`.
- `hooks/hooks.json`: the module and the command `Stop` hook.
- `hooks/register.tsx`: the hooks module: the lens card (L1 to L6), the probes (E1 to E8) and the round-0 kit (K1 to K5).
- `hooks/lens.ts`: pure helpers of the card: figure formatting, record matching, the flowchart Svg.
- `scripts/gate-alert.mjs`: check K5, 5a.
- `types/index.d.ts`: the `$.state` contract.
- `tests/spike.test.tsx`: the headless tests.
- `.tsc/tsconfig.json`: the tsconfig for `tsc`.
- `GATE-ALERT.txt` and `PROBE-LOG.jsonl`: written at run time, not committed.
