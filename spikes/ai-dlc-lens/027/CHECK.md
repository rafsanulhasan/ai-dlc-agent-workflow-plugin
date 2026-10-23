# ITEM-027 spike (a): manual check in VS Code

Throwaway mod plugin `ai-dlc-lens-spike-027`. It is not plugin source: it is deleted before the lens PR leaves draft. The software-architect cites the results in the spec (ITEM-005).

Round 1 (step 17, 2026-10-23) reworks the spike to the lens card the human described on 2026-10-23 (`docs/handoffs/FEAT-20261020-ai-dlc-lens/15-claude-lens-gap-analysis.md`, "Human decisions" 2), following the layout and fallbacks of step 16 (`16-research-assistant-to-orchestrator.handback.md`). `/spike027` now opens the lens card. The round-0 kit (resize, Svg blink, buttons, transcript cards, gate alert) is still there, as `/spike027-kit`, checks K1 to K5 below.

Round 2 (step 17.l1, 2026-10-23) moves the card into the chat. In the round 1 check, two agents spawned in parallel showed only the round-0 card in the chat, because the flowchart lived in the `/spike027` pane. The human asked for it at the top of the card in the chat. Now the first `Agent` call of an assistant message draws, in its own transcript row, one flowchart for every `Agent` call of that message, with parallel spawns side by side. Under the chart are the avatar and arrow Buttons, the collapsible thinking and gathered context, and the native row last. **Check C1 first: spawn two agents in parallel and look at the chat card. No command is needed.** The `/spike027` pane still works as a second view (L1 to L6).

Round 3 (step 17.l2, 2026-10-23) applies the human's findings 1 to 6 on the round 2 card and three addenda. **Check R1 first** (below). In short:

- The chart is smaller (120 px per avatar, was 200) and shows three lines per avatar: the persona name, the model and the role. No context, tokens or cache in it.
- When the row is narrower than the chart, the card shows a one-line chip and an "Open flowchart" Button, which opens the chart in its own pane. Claude Code 2.1.309 has no way to add a button to the VS Code prompt toolbar (see the round 3 automatic checks), so the Button is in the card.
- The second agent of a parallel pair keeps its avatar, its arrow, its Buttons and its name. Its avatar blinks only while it runs.
- Names: the persona from the roster (Kent Beck, KB), the model as the agent definition writes it (`sonnet`), the role in words (SQA Engineer).
- The arrow panel shows the orchestrator's prompt when no handoff record was named.
- The figures (context and window, tokens, cache, cost) are in the avatar panel. Cost and a subagent's window come only from `.ai-dlc/model-metadata.json`, or from `.ai-dlc/model-costing.json`, the file's name before the rename. A missing file or model shows `—`.
- The prompt is gone from under the gathered-context section.
- Every `[+]`/`[-]` section starts collapsed.
- Every lens setting can be changed (S1 to S4).

Round 4 (step 17.l3, 2026-10-23, version `0.1.3`) applies the human's round 3 findings and five addenda. **Check W1 first** (below). In short:

- **"Agent:Wait test agent one".** The spike drew the Agent call's `description` in two places: the gathered-context and tool-call rows (`summarize` picked `description` for an Agent call, so the row read `Agent Wait test agent one`) and the background-task rows (a subagent's task carries that `description`). Both now name the agent by its type or its persona name, never by the `description`. The native Agent row is Claude Code's own and is not changed: it still gets the call's input without the prompt, as in round 3. If W1 still shows the label after this round, the native row draws it (see W1).
- **No sources.** The panels and the `/spike027` pane no longer say where a figure came from: no model source, no window source, no metadata file name, no setting level, no "Record matched". The values stay, and a missing value still shows `—`. The sources stay in state and in `PROBE-LOG.jsonl`. `/spike027-lens-configure` still names the level of a setting.
- **Background tasks.** Each task is its own `[+]`/`[-]` entry. Collapsed, it is one line: the description and the status (a subagent's task shows its agent's persona name instead of the `description`). Opened: type, id, start and end time (when the lens first saw it and saw it end), the agent type for a subagent, and its output when one is known (a subagent's last message).
- **The workflow pane.** Claude Code 2.1.309 has no band pinned at the top of the chat in VS Code: `AbovePrompt` is "raised on the terminal and desktop surfaces only" (d.ts:10817), and a `Pane` is "placed by the surface (docked in fullscreen, else above the prompt)" and "raised on every attached surface" (d.ts:10870-10874). So the flowchart moved out of the chat into the **AI-DLC workflow** pane, which the lens opens on the first spawn of a session and which updates live. An open that no person asked for may be left undrawn (d.ts:15062-15068, `UiOpenResult` `isPlaced: false`). The chat card is now one line, `Workflow: <title> - DF completed, KB running`, and an "Open flowchart" Button, which always opens the pane.
- **Several workflows.** The pane shows one workflow as it is. With several, each is a collapsible section headed by its title: the run's title from its `run.md` when a brief names a handoff record, else the request (the main loop's prompt) or the brief that made the calls. Never the `description`. The newest is first and open; older ones are collapsed.
- **A later spawn joins the chart (bug).** A workflow is no longer one message's batch. A spawn joins the workflow of its spawner while any agent of that workflow (a descendant included) is still running or not started, across messages and turns; an agent spawned by an agent of a workflow always joins it. A spawn starts a new workflow when every agent of the spawner's last workflow has finished, or when a new spawner (one with no workflow yet) spawns. A headless run proved it (below).
- **Side panels.** The avatar and arrow panels have a header (initials badge, the name in bold, a coloured status badge: running, waiting, done or failed; model and role dim under it) and sections with a divider, a heading and a count: Usage (a bar and label/value rows), Tool calls, Background tasks, Thinking; on the arrow panel Usage, then Handoff and Hand-back, or Prompt. Every section starts collapsed and remembers its state per agent.
- **Null limits.** The Usage section lists the model's limits from the metadata file (long-context window, max input, max output) only when the file gives a number: a null limit has no row. `—` stays for a figure the panel must have: the window in "Context", and the cost.

Not possible with the 2.1.309 components: a real divider element (the divider is a dim `─` line), a scroll box inside a panel (long text is in a collapsed section; the pane body itself scrolls), and pinning in VS Code (see above).

`<REPO>` is the main checkout of this repository, the folder registered as the `ai-dlc-agent-workflow` marketplace (`CLAUDE.md`), switched to the `feat/ai-dlc-lens` branch. `<SPIKES>` = `<REPO>\spikes\ai-dlc-lens`; `<SPIKE>` = `<SPIKES>\027`, this plugin.

## What was checked automatically, round 4 (2026-10-23, Claude Code 2.1.309)

- `claude plugin validate 027`: passed. `npx -p typescript@5 tsc -p 027/.tsc`: no errors. `claude plugin test 027`: 48 tests pass, 0 fail.
- Tests added: no rendered text contains an Agent call's `description` (cards, context, chip, panels, `/spike027` pane, background tasks); no rendered text contains a source label; each background task collapsed and expanded; a later spawn joins a running workflow (the replayed event order); a new workflow after all finished, with titles and sections; `joinWorkflow` rules; the panel's divided and counted sections; a null limit has no row.
- Headless run (`claude -p --setting-sources user --plugin-dir <SPIKE> --model haiku --input-format stream-json --output-format stream-json --verbose`, probes on): agent A spawned in the background with a 60 s timer; agent B spawned from the next message while A ran. At the next `Stop` the E9 line had A `running`, B `running`, and one workflow with both as members; at the last `Stop` both `completed`, still one workflow. The auto-open of the workflow pane returned `isPlaced: false` ("no-surface"), as expected headless.
- What the headless tests cannot show: what the native Agent row draws (the test harness stubs it), and where VS Code places the workflow pane.

## What was checked automatically, round 3 (2026-10-23, Claude Code 2.1.309)

- **Root cause of findings 1c, 1d (the "SE" label) and 6.** A headless run started two parallel Agent calls, `ai-dlc:software-engineer` and `ai-dlc:sqa-engineer`, each running an 8 s `node -e setTimeout`. It ran with `claude -p --setting-sources user --plugin-dir <SPIKE> --plugin-dir <REPO>\plugins\claude\ai-dlc --model haiku`, with probes on. New E9 lines show the order of events:
  - each subagent's own `turn.start` runs before the lens's `agent.spawn` hook resumes after `next(e)` (`turn.start` at .519, spawn patch at .524). So the round 2 code always saw the agent as "already there" and drew every arrow two-way (`loop: true` for both agents).
  - Round 2's `ensureAgent` wrote a blank record whenever its earlier read had found none. A `turn.start` that read before `agent.spawn` wrote, and wrote after it, therefore replaced the spawned agent with a blank one: no type and no call id. Its call stayed a placeholder. The placeholder blinked for ever, was named from its call's type (`sqa-engineer`, title-cased to "Sqa Engineer", so "SE"), and had no Buttons, because round 2 drew Buttons only for agents in the stored state. That matches findings 1c, 1d and 6 exactly. The headless run did not hit this interleaving (it is a timing race); the test `C2b` and the `ensureIn` unit test pin the fix.
  - The fix has four parts. The existence check now runs inside the write (`ensureIn`). A two-way arrow needs an earlier spawn under another call (`isRespawn`). The lens keeps a separate call-to-agent map from `agent.spawn` and from the Agent call's result (`callAgent`). Placeholders never blink and get their own Buttons. A `$.agent.list()` that still says `running` no longer undoes a `turn.complete`.
  - The same headless run after the fix: both agents mapped, `loop: false` for both, one batch with both calls.
- **1b, a button in the prompt toolbar.** Not possible. The render sites (`RenderComponent`, `.tsc/claude-code.d.ts`:9835) include no prompt-toolbar site. The two prompt-side sites, `PromptHint` and `AbovePrompt` (:10769-10830), are "Raised on the terminal and desktop surfaces only": VS Code is not one of them. The fallback is a chip with an "Open flowchart" Button in the card, opening the pane `lens-027-chart`. The card measures its width from the row's `viewport.columns` (cells, :10957-10962). One cell is taken as `cellPx` = 8 CSS px, because no API gives the cell width. Without a viewport the chart is drawn, and `Svg` shrinks to its slot on its own (:13099-13105).
- **5, the native row without the prompt.** The card calls `next(e)` with the Agent input minus `prompt`. When the row is expanded (`isExpanded`, :10409-10417), the input is passed whole, so ctrl+o still shows everything. The subagent's response (`ToolResult`) is untouched. Whether VS Code's native row honours the rewrite is R5.
- `claude plugin validate <SPIKE>`: passed (the icon warning only).
- `npx -p typescript@5 tsc -p <SPIKE>\.tsc` (2.1.309 types): exit 0.
- `claude plugin test <SPIKE>`: 39 passed, 0 failed. The tests cover:
  - names, models and roles;
  - the cost and the window from the file, and `—` when it is missing;
  - `model-metadata.json` read before `model-costing.json`;
  - the root cause (`C2b`, `ensureIn`, `isRespawn`, batch folding);
  - blinking only while running;
  - the narrow chip and the chart pane;
  - the native row without the prompt;
  - the prompt in the arrow panel;
  - the figures in the avatar panel;
  - every section collapsed at first;
  - the settings precedence;
  - `/spike027-lens-init` and `/spike027-lens-configure`.

## What was checked automatically, round 2 (2026-10-23, Claude Code 2.1.309)

- Render site: `ToolUse`, the transcript row of each tool call. It is the only one of the 15 render sites (`RenderComponent`, `.tsc/claude-code.d.ts`:9835) drawn for an `Agent` call. `ToolGroup` folds only reads, searches and listings (:10492-10542). A row redraws when the `$.state` it read changes (:3491-3492, :4105-4106), so the chart updates live. `Svg` is limited by surface, not by site: VS Code, desktop and mobile have it, the terminal does not (:3946-3995, :10124-10135). The terminal therefore gets a text chart. The parallel calls are grouped by the `turn.step` tool chunks of one message, which carry each call's id and tool name (:14547-14563).
- `claude plugin validate <SPIKE>`: passed, with the same icon warning. The hooks are the same as in round 1. The module now also reads and writes the state keys `batches` and `cardOpen`.
- `npx -p typescript@5 tsc -p <SPIKE>\.tsc` (2.1.309 types): exit 0.
- `claude plugin test <SPIKE>`: 21 passed, 0 failed. The new tests are C1 to C5 and the reworked K4. They check the chat card for one call and for two parallel calls, on VS Code and on the terminal:
  - the chart comes first;
  - each avatar has its five lines;
  - parallel avatars sit side by side, one row under the orchestrator's;
  - Button keys are unique;
  - the second row of the message is compact;
  - a call not yet spawned shows a placeholder;
  - the blink stops when an agent finishes, with no explicit redraw;
  - the chat Buttons open the separate panes even in drill-in mode;
  - thinking and context collapse;
  - the native row is the last element.
- One headless run, `claude -p --setting-sources user --plugin-dir <SPIKE> --model haiku --input-format stream-json --output-format stream-json --verbose`, with `/spike027-probe on` and then a request for two Agent calls in one response. Both `tool_use` blocks came in one assistant message, both named `Agent`. The main loop's first step logged `counts.tool: 2` (E2), which is the batch the card groups. The debug log shows no hook error from the module. Headless runs draw no rows, so the card itself still needs C1 to C6 in VS Code.
- "3 errors during load" after `/reload-plugins`: reproduced headless with `claude -p "/reload-plugins" --debug-file <file>`, which printed `3 errors during load. Run /plugin for details.` None of the three is from 027 or another spike. They come from this machine's setup:
  - `superpowers@claude-plugins-official` is enabled in `.claude/settings.json` but not installed;
  - `sonarqube@claude-plugins-official` is in the same state;
  - two claude.ai-synced `figma` copies declare the same name, so one is not loaded.

  The same log shows `ai-dlc-lens-spike-027` read from `<SPIKE>` and its module loaded with no error. `claude plugin validate` passes for 027, `028/spike028-ka`, `028/spike028-lens` and 029.

## What was checked automatically, round 1 (2026-10-23, Claude Code 2.1.309)

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
3. For round 2 nothing needs typing: spawn agents and the card is in the chat (C1). `/spike027` opens the pane view "AI-DLC lens (spike 027)".

Round 4 is version `0.1.3` (round 3 was `0.1.2`, round 2 `0.1.1`). If an earlier round is installed, run `claude plugin marketplace update ai-dlc-agent-workflow` and then `claude plugin update ai-dlc-lens-spike-027@ai-dlc-agent-workflow --scope local`, or uninstall and install it again. Then run `/reload-plugins`, or start a new session. `/reload-plugins` reports "3 errors during load" on this machine; none is the spike's (see the round 2 automatic checks).

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

## Round 4 manual checks (W1 to W7)

| # | What to do | Expected | Result |
|---|---|---|---|
| W1 | Ask for one agent in the chat (`description: "Wait test agent one"`). Look at the chat card and at every line around it. | The card reads `Workflow: <title> - <initials> <status>` and an "Open flowchart" Button. No line drawn by the lens contains "Wait test agent one". If "Agent:Wait test agent one" (or similar) is still there, it is Claude Code's native Agent row: note exactly where it is. The spike does not hide the native row (US-15, AC-15.5). | |
| W2 | After the first spawn of a session, look for the **AI-DLC workflow** pane. Scroll the chat. | The pane opened by itself, or after "Open flowchart". It stays where VS Code put it while the chat scrolls, and updates live. Record where VS Code shows it. | |
| W3 | Spawn agent A in the background, then, in a later message while A runs, agent B. | One chart in the pane with both avatars and both arrows from the spawner; both blink while they run. | |
| W4 | After every agent has finished, spawn another. | The pane shows two sections, the newest first and open, the older collapsed. Each header is the run's title or the request, never "Agent: ...". | |
| W5 | Press an avatar. | Header: initials badge, bold name, coloured status badge, model and role dim under it. Sections Usage, Tool calls (n), Background tasks (n), Thinking (n chars), each collapsed; Usage shows a bar and right-aligned values; no "from ..." anywhere. Narrow the panel: it wraps. | |
| W6 | Open Background tasks for an agent with a background task. | One line per task, `description - status` (a subagent: its persona name). `[+]` shows type, id, started, ended, agent type, output. | |
| W7 | With `.ai-dlc/model-metadata.json` present, open Usage of an agent on a model in the file. | Max output (and a long-context window or max input only when the file has a number); no `—` rows for null limits. Cost shows a value, or `—` for a model not in the file. | |

## Round 3 manual checks: the human's findings (no command needed for R1 to R9)

Setup as for C1: a new session with the orchestrator in VS Code, then: `In ONE response, make two Agent tool calls in parallel: an ai-dlc:software-engineer and an ai-dlc:sqa-engineer, each told to run node -e "setTimeout(()=>{},30000)" with Bash and then reply OK.`

| # | Finding | What you should see | Result |
| --- | --- | --- | --- |
| R1 | 1a smaller, no figures | The chart is about 240 px wide for two agents. Under each avatar there are three lines: the persona name in bold, the model, the role. No `ctx`, `in`/`out` or `cache`. Record whether a five-agent fan-out (600 px) fits. | |
| R2 | 1b responsive | Make the Claude Code panel narrow (under about 30 columns for two agents). The chart gives way to one line, for example `DF running, KB running`, and an `Open flowchart` Button. Press it: the pane "AI-DLC flowchart" opens with the full chart and its Buttons. Widen the panel: the chart comes back. No button can be added to the prompt toolbar (round 3 automatic checks). | |
| R3 | 1c the second agent | Both avatars, both arrows, and under "Arrows:" both `Scott Hanselman -> David Fowler` and `Scott Hanselman -> Kent Beck`. "Avatars:" has a Button for each. `Kent Beck`'s avatar panel has its tool calls and `View transcript`. | |
| R4 | 1d names | Avatars read `DF` and `KB` (`SH` for the orchestrator). Name lines: `David Fowler`, `Kent Beck`, `Scott Hanselman`. Model lines: `sonnet`, `sonnet`, `opus`, as `model:` in each agent definition. Role lines: `Software Engineer`, `SQA Engineer`, `Orchestrator`. | |
| R5 | 5 the prompt under gathered context | Under `[+] Gathered context` there is the native Agent row without the prompt text. Expanding the row (VS Code's own expand, or ctrl+o) shows the prompt again. If VS Code still draws the prompt, record it: it means the native row ignores the rewritten input. | |
| R6 | 6 blinking | Each avatar blinks only while its agent runs. Once an agent replies, its avatar is solid green, without a click or a scroll. An agent that has not started yet is grey and steady. | |
| R7 | 2 the arrow panel | Press `Scott Hanselman -> Kent Beck`. With no handoff record named in the brief, the pane shows `Prompt from orchestrator (no handoff record)` and the whole prompt. With a record (an orchestrator run), the record and hand-back sections show, both collapsed. | |
| R8 | 3, 4 the avatar panel | Press `Kent Beck`. The panel shows `Model: sonnet from agent definition (...)`, `Ran on: <id>`, `Context: X / Y window from <file or main session>`, `Tokens: in X, out Y`, `Cache: read / write / uncached`, and `Cost: $… from <file>`. With neither `.ai-dlc/model-metadata.json` nor `.ai-dlc/model-costing.json` in the repository, `Cost: — (…not found)` and a window of `—` for a model other than the orchestrator's. The panel names the file it read. | |
| R9 | collapsed by default | Every `[+]` in the card, in `/spike027` (thinking, gathered context, lens settings) and in the two panels (handoff record, hand-back, thinking) starts as `[+]`. | |

## Lens settings (S1 to S4)

Each setting comes from the first of these levels that holds a valid value: `AI_DLC_LENS_*` in the `env` of `.claude/settings.local.json`, then in the `env` of `.claude/settings.json`, then `.ai-dlc/lens.json`, then the default. An invalid value is skipped and the next level decides. The process environment is never read. `/spike027-lens-init` and `/spike027-lens-configure` stand in for the product commands `/ai-dlc:lens-init` and `/ai-dlc:lens-configure`, which belong in the plugin, which this spike does not touch.

Settings: `chartMode` (auto, chart or button), `breakpointColumns`, `cellPx`, `chartColumnPx`, `chartRowPx`, `avatarRadiusPx`, `collapsedByDefault`, `blink`, `blinkMs`, `showCost`, `cacheWriteRate` (5m or 1h), `windowFallback` (main or none), `costingPath` (`.ai-dlc/model-metadata.json`), `costingFallbackPath` (`.ai-dlc/model-costing.json`), `rosterPath`, `contextLimit`, `callsLimit`, `callsShown`, `recordChars` and `thinkingChars`. The env name is `AI_DLC_LENS_` plus the key in upper snake case (`chartColumnPx` is `AI_DLC_LENS_CHART_COLUMN_PX`). `.ai-dlc/lens.schema.json` documents each one.

| # | Steps | What you should see | Result |
| --- | --- | --- | --- |
| S1 | `/spike027-lens-init` | It writes `.ai-dlc/lens.json` with every default and `.ai-dlc/lens.schema.json`; an existing `lens.json` is kept unless you pass `--force`. Open `/spike027`, press `[+]` beside "Lens settings": every key with its value and `[default]` or `[.ai-dlc/lens.json]`. | |
| S2 | `/spike027-lens-configure chartColumnPx 200`, then spawn two agents again. | The reply shows `chartColumnPx = 200 [.ai-dlc/lens.json]`. The new card's chart is wider (400 px for two). Then `/spike027-lens-configure chartMode button`: the next card shows the chip and the `Open flowchart` Button at any width. | |
| S3 | Add `"AI_DLC_LENS_CHART_MODE": "chart"` to the `env` of `.claude/settings.json`, then send a prompt (settings are re-read after each main turn) or reopen `/spike027`. | The settings list shows `chartMode = "chart" [.claude/settings.json env]`. The card draws the chart again. Then add `"AI_DLC_LENS_CHART_MODE": "button"` to `.claude/settings.local.json`: it wins (`[.claude/settings.local.json env]`). `/spike027-lens-configure chartMode chart` then says `A higher level wins`. | |
| S4 | Set `"AI_DLC_LENS_BLINK": "maybe"` in `.claude/settings.local.json`, and `/spike027-lens-configure collapsedByDefault false`. | The settings list shows a yellow line `... AI_DLC_LENS_BLINK = "maybe" is invalid, ignored`, and `blink` comes from the next level. New sections open as `[-]`. Remove both afterwards, and delete `.ai-dlc/lens.json` and `.ai-dlc/lens.schema.json` when the checks are done: nothing ignores them, so a commit would pick them up. | |

## Round 2 manual checks: the card in the chat (no command needed)

Setup: open a new session with the orchestrator in VS Code, then ask for two agents in parallel. For example: `In ONE response, make two Agent tool calls in parallel: an ai-dlc:software-engineer and an ai-dlc:sqa-engineer, each told to wait about 20 seconds (sleep 20 with Bash) and then reply OK. Run them in the background.` Look at the chat; do not open `/spike027`.

| # | Design item | What you should see in the chat | Result |
| --- | --- | --- | --- |
| C1 | 2. The workflow at the top of the card | The first Agent row of that response sits in a rounded card. The card opens with `Workflow: Orchestrator spawned 2 agents in parallel`, then the flowchart: the orchestrator's avatar on top and the two agents' avatars side by side under it, an arrow to each. The terminal shows a text chart (`-> ● Software Engineer (...)`) in place of the drawing. | |
| C2 | 3. Five lines under each avatar | Under each avatar: name (model), role, `ctx used/window`, `in X, out Y`, `cache r / w / uncached`. The figures grow while the agents run. The window rules are those of L3. | |
| C3 | 6. Live status | While an agent runs, its avatar fades in and out about once a second. When it finishes, the avatar turns solid green with no click or scroll. Failed or killed agents are red. A call whose agent has not started yet shows `(?)` as its model until it starts. | |
| C4 | 4, 5. Panel Buttons | Under the chart there are two rows of Buttons. "Avatars:" has one Button per agent, the orchestrator included. "Arrows:" has one Button per arrow, such as `17 Orchestrator -> Software Engineer` when the brief names a record. An arrow Button opens the `Hand-off: ...` pane (L4). An avatar Button opens the `Agent: ...` pane (L5). They open as separate panes even when the `/spike027` pane is in drill-in mode. | |
| C5 | 1. Thinking and gathered context | Under the Buttons: `[+] Orchestrator thinking (N chars)` and `[+] Gathered context (N calls)`. Each opens and closes in the card. Thinking may be the `[no thinking text: ...]` line, as in L1. | |
| C6 | Responses never hidden (US-15, AC-15.5) | The native Agent row is the last part of the card, unchanged, and the subagent's result row under it is unchanged too. The second Agent row of the same response shows one dim line, `lens: agent 2 of 2 spawned in parallel; the flowchart is on the first of them, above`, with its native row under it. Expanding (ctrl+o, or VS Code's own expand) still shows the full responses. | |

Also record: whether the drawing fits the chat width, or is cut off or scrolls (each avatar takes 200 px); and whether a later response that spawns agents again gets its own card.

## Setup for the round 1 checks (the `/spike027` pane, second view)

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
| L6 | 6. Responses never hidden; two-way arrow for a loop; running agents blink green, finished ones green without blinking | Watch the avatars while agents run and after. Make the orchestrator send a `SendMessage` to a running agent, or spawn the same agent type again from the same spawner. Expand an Agent row in the transcript. | Running avatars fade in and out about once a second; finished ones stay solid green; failed or killed ones red; waiting ones amber. The arrow to an agent messaged again or respawned gets an arrowhead at both ends and its Button reads `<->`. In the transcript each Agent row sits inside the round 2 chat card (C1 to C6), with the native row and the subagent's full response unchanged. | |

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
2. Run K4 to get a card in the transcript, then click the card's `[+]` beside "Gathered context".

Expected: the label switches between `[+]` and `[-]` and `presses=` goes up by one on every click. In the pane, "expanded content..." appears and disappears. On the card, the list of gathered context appears and disappears.

What each outcome means:

- **Pane and row both work:** expand and collapse are possible in both places.
- **Pane only:** cards cannot expand. Show the details in the pane instead.
- **Neither works:** use the keyboard: Tab to the button, then Enter. Record whether that works.

### K4. Transcript cards (the native response is never hidden)

Steps:

1. In the session, type: `Use the Explore agent to list the files in the hooks folder of this plugin, then reply DONE.`
2. Optional, for teammates: run a prompt that makes Claude use `SendMessage`.

Expected: the `Agent` call row is drawn inside a rounded card that starts `Workflow: <spawner> spawned 1 agent` (round 2; the round-0 header `LENS CARD` is gone). The native row is inside the card, last. The subagent's result row under it is unchanged. The full response is still visible after expanding with ctrl+o, or the native expand in VS Code. Section [4] of the kit pane counts the cards drawn and the ToolResult rows passed through.

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
- `hooks/register.tsx`: the hooks module: the chat card (R1 to R9, C1 to C6), the chart pane, the lens pane (L1 to L6), the settings commands (S1 to S4), the probes (E1 to E9) and the round-0 kit (K1 to K5).
- `hooks/lens.ts`: pure helpers of the card: names, models and roles, the cost and window from the model metadata file, record matching, the flowchart Svg, the width rule, the batching of parallel Agent calls and the terminal's text chart.
- `hooks/settings.ts`: the lens settings, their levels, the schema and the `lens.json` edits.
- `scripts/gate-alert.mjs`: check K5, 5a.
- `types/index.d.ts`: the `$.state` contract.
- `tests/spike.test.tsx`: the headless tests.
- `.tsc/tsconfig.json`: the tsconfig for `tsc`.
- `GATE-ALERT.txt` and `PROBE-LOG.jsonl`: written at run time, not committed.
