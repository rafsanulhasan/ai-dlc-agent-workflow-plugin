# ai-dlc-lens

A Claude Code plugin that shows an AI-DLC run while it happens. When the orchestrator spawns agents, the **AI-DLC workflow** view appears: one workflow per run (the work item, its `docs/handoffs/<run>/` folder), each a collapsible panel holding one flowchart per top-level step of the run (**in progress**, see [Panels and controls](#panels-and-controls)), with its agents drawn as avatars (persona name, model, role and a status dot). A new run never hides an earlier one, and agents of a different run never join an earlier run's workflow. Pressing an avatar opens the agent's panel (usage, tokens, context window, cost, tool calls, background tasks, thinking); pressing an arrow opens the hand-off panel (the handoff record and the hand-back, or the prompt). The chat card of a workflow's first spawn names the workflow, draws its flowchart and opens the view.

- **Drill-in or tab.** An avatar or arrow opens its panel inside the card or view it was pressed in, with `< Back` (`drill-in`, `panelOpenMode`'s default), or as a separate pane (a tab, `tab`). The **Panel Type** switch `◉ Drill in  ○ Tab` changes it for the session (see [Panels and controls](#panels-and-controls)).
- **Pinned or docked.** Pinned (`workflowPlace`, the default) draws the view in the band above the prompt on the terminal and the desktop app; VS Code has no such band, so there it stays a pane. Docked draws it in the pane, which the surface places. The view's first row also has full screen, minimise and restore (back to the size before); no mod can make a pane full screen or minimise it, so these are drawn by the lens itself, as [MANUAL-CHECKS.md](MANUAL-CHECKS.md) (*Step 1.5*) explains. [Full screen](#full-screen) shows one step of one run alone.
- **Wide or narrow.** From `wideColumns` columns (70) the runs are stacked as collapsible panels on the right, with the selected run's step charts beside them; narrower, the view lists the runs, one row each, and opens the one you choose.

**In progress:** this plugin is being built in the run `FEAT-20261020-ai-dlc-lens`, and its reviews are still open. It started as spike ITEM-027 (round 6) and has since been extended (steps 8.1.2 to 8.6.1.l1 of that run: robot avatars, keep-alive figures, the anomaly detector, Panel Type, full screen, one chart per step). It still goes through that run's scope pass and gates G1, G2 and G3 before it is released. Until then the commands, settings and panes can change. This README describes only what exists now.

**Claude Code only.** The lens is a Claude Code mod (a hooks module). The GitHub Copilot build (`tools/build-copilot.mjs`) skips this plugin, and only the Claude marketplace (`.claude-plugin/marketplace.json`) lists it. It does not depend on the `ai-dlc` plugin for its panes, and `ai-dlc` does not depend on it; the `/ai-dlc:lens*` commands are skills of `ai-dlc`. When `ai-dlc` is installed and its keep-alive is pinging, the workflow pane shows one keep-alive line under its controls (`keep-alive: 5m ping 1/20, next 14:05:07`), read-only from the state keep-alive publishes; without it, or with no track running, the line is not drawn. The minimum Claude Code version is decided at G2; the repository `README.md` (*Setup*) and [MANUAL-CHECKS.md](MANUAL-CHECKS.md) give the version the checks name, and neither is the final answer until then.

## Install

From the repository root, with the `ai-dlc-agent-workflow` marketplace registered (see the repository's `CLAUDE.md`):

```text
claude plugin marketplace update ai-dlc-agent-workflow
claude plugin install ai-dlc-lens@ai-dlc-agent-workflow --scope local
```

Then run `/reload-plugins`, or open a new session. For one terminal session without installing: `claude --plugin-dir plugins/claude/ai-dlc-lens`.

## Commands

The commands are named by thin skills of the `ai-dlc` plugin, so Claude Code lists them as `/ai-dlc:<name>`; this plugin's hooks module answers each run itself (a hooks module can only register a name without `:`). Claude Code lists the commands only when `ai-dlc` is installed; typed in full without it, the lens still answered them in a headless run (`claude -p "/ai-dlc:lens-gate off"`). The panes and the chat card work with this plugin alone.

| Command | What it does |
|---|---|
| `/ai-dlc:lens` | Opens the lens pane (the older single-pane view). The workflow view appears on its own at the first spawn. |
| `/ai-dlc:lens-init [--force]` | Writes `.ai-dlc/lens.json` with every default, and its schema. |
| `/ai-dlc:lens-configure [<key> [<value>\|--unset]]` | Shows the lens settings and the level each comes from, or sets or unsets one in `.ai-dlc/lens.json`. |
| `/ai-dlc:lens-keepalive [on\|off]` | Shows or hides the **Cache keep-alive** section of the agent panes (setting `keepaliveSection`, on by default), then reports its figures. |
| `/ai-dlc:lens-gate [on\|off]` | Turns anomaly reporting on or off (setting `gateAlert`); bare, it lists the current anomalies, then the runs it read and the `anomalyRunScope` in force. See [Anomaly alert](#anomaly-alert). |
| `/ai-dlc:lens-kit` | Opens the round-0 kit pane (manual checks K1 to K5). |

The **Cache keep-alive** section, after Usage in every agent pane and collapsed like every section, shows how long keep-alive kept the prompt cache warm on the 5m and 1h tracks (from each arming to the cache's expiry, read from the state `ai-dlc` publishes; `0s` without it) and what cache reads saved, for the agent and for the session: cache-read tokens times the input price minus the cache-read price, from the model metadata file (`costingPath`), `—` when a price is missing.

The spike's experiments E1, E2, E4, E5, E7, E9 and E10 log to `PROBE-LOG.jsonl` in the plugin's folder while the `probes` setting is on (off by default). The pane ids are `ai-dlc-lens`, `ai-dlc-lens-chart`, `ai-dlc-lens-edge`, `ai-dlc-lens-agent` and `ai-dlc-lens-kit` (a pane id takes no `:`).

## Panels and controls

- **Workflow view** (title "AI-DLC workflow"). One collapsible panel per run; the selected run's step charts are drawn beside the list (wide) or under the run (narrow): see *Step charts* below. The first row has the pinned/docked switch, full screen, minimise and restore; below it is the **Panel Type** switch `◉ Drill in  ○ Tab` (drill-in by default; `◉` marks the current choice and each choice is its own button). The switch also appears in the `/ai-dlc:lens` pane, changes the session only and never writes `.ai-dlc/lens.json`. Every `[+]`/`[-]` section starts collapsed unless `collapsedByDefault` is off. Below each step chart are `Avatars:` and `Arrows:` button rows. The workflow's orchestrator thinking and gathered context are sections of the view.
- **Chat card.** The first spawn of a workflow leaves a card that names it and draws its flowchart (`chartInChat`), or a chip with an "Open flowchart" button when the row is narrower than `chartMode` allows. **In progress:** when the card's agents work on unrelated tasks (a task is a run plus a feature root), the card draws one titled chart per task, with an agent that has no record (or a gone one) joining the first task's chart; with one task the card is unchanged.
- **Agent panel** ("Agent: ..."). A header with the avatar, persona name, model and role, then these sections: Usage (context, input, output, cache read and write, uncached, cost, the model it ran on, limits from the metadata file), Cache keep-alive (see above; `keepaliveSection`), Tool calls, Background tasks (each task listed once, starting collapsed, and toggling on its own), Thinking; and the buttons View transcript and Refresh.
- **Hand-off panel** ("Hand-off: ..."). The arrow's Handoff section, Hand-back section and Prompt section (the prompt when the brief names no record), and Usage.
- **Status.** A dot per run and a ring per agent. Colours (settings, hex): in progress `statusInProgressColor` (blinks, `statusBlink`), pending `statusPendingColor`, halted `statusHaltedColor` (an agent failed or was killed, or the run is blocked), waiting `statusWaitingColor`, completed `statusCompletedColor`.
- **Keep-alive line.** One dim line under the controls row, `keep-alive: 5m ping 1/20, next 14:05:07`, only while `ai-dlc`'s keep-alive runs a track. The minimised one-line view has none.
- **Layout.** Wide (from `wideColumns`): runs stacked on the right, the selected run's step charts on the left, `runListColumns` wide. Narrow: a list of runs, one row each; choosing one opens it and `< Runs` goes back. Every run stays listed; finished runs are dimmed. **In progress:** the list (wide and narrow) and the full-screen `Runs:` row are ordered newest first by each run's start: its first spawn, else the date in its folder name, else `started:` in its `run.md`. A run resumed later keeps its place, and the selected run stays selected.
- **Parent runs.** **In progress:** a run whose `run.md` front matter has `parent: <run id>` is drawn inside its parent's workflow, its step charts titled `<child run>: Step N` (a child keeps its own step numbers), and is not listed on its own. A chain of parents goes to the top run; an unknown parent or a cycle keeps the run as its own. The merged run is ordered by the parent's start, and a child's anomalies keep the child run's name.
- **Merged-away runs.** **In progress:** a brief that names a run folder which no longer exists joins the run that keeps a `merged-from-<run>.md` record for it, at the step shifted by the merge offset (when `run.md` has the Offset table).
- **Chart rows wrap.** **In progress:** a chart row holds at most `chartAvatarsPerRow` avatars (default 8, see [Settings](#settings)); a level with more wraps onto further rows. It applies inside each step chart, the chat card and full screen (full screen enlarges the sizes, not the count).
- **Run identity.** A workflow is a run (its `docs/handoffs/<run>/` folder). Agents of another run never join it; when a spawn names no run, the same request text joins, else it starts a new workflow.
- **Step charts.** **In progress:** a run has one chart per feature root (top-level step), read from the record files in its `docs/handoffs/<run>/` folder as well as from live spawns, so earlier steps are drawn without having been spawned in this session.
  - Each chart is headed by its status, its ▲ anomaly marker, a title `Step N · <feature>` and a `⤢` button (shows that step in full screen), then the chart, then its `Avatars:` and `Arrows:` button rows. The feature name comes from the *Features* table of the run state, falling back to its *Stages* table, then to `Step N`.
  - The chart's root is the step itself, drawn as its sender (usually the orchestrator). The step's own record is a node under it, with its loop rounds (`17.l1`) under that node; sub-steps (`28.1`) hang under the root and deeper codes under their prefix. In the current naming a loop has no record of its own: its rounds (`8.2.l1.1`, `8.2.l1.2`, `8.2.l2.1`) hang under their sub-root (`8.2`) joined to it by a two-way arrow, a round's own sub-numbers (`8.2.l1.1.1`) hang under the round, and the loop code (`8.2.l1`) is never a node. Review axes are sub-numbers too (`8.4.1` and `8.4.2` under the review step `8.4`). A loop code that does have a record (the older naming) is drawn as described above. Each node's second line starts with its step code (`28.1 · sonnet`).
  - A node drawn only from a record is green with a hand-back and grey without. A code with no record of its own that sits between the root and a record (`1.2` above `1.2.l1`) is drawn as the orchestrator, steady (not blinking). A live spawn takes the node of the record its brief names; loop rounds, resumed agents, spawns from earlier sessions or from before `/clear`, and absolute or worktree paths join the chart of their step.
  - Charts are ordered by step code, highest first, live or not; sub-steps inside a chart are in code order. After the run's own charts come those of child runs (by child folder, then step, highest first), then the chart of spawns that name no step, then the `Briefs naming records no longer on disk` line (next bullet). Step numbers decide the order, not file times.
  - Old briefs written before a run was renumbered join the node their record was renamed to. **In progress:** a run folder may hold rename sources, `.json` or `.md` files whose name has the word `rename` at its start or after a character that is not a letter or digit (`renames.json`, `2026_renames.json` and `un-renamed-notes.md` are sources; `prename.json` and `unrenamed-notes.md` are not), and that are neither records nor run states: a `.json` source with a `codeMap` object (old code to new code), or a `.md` source with a table whose first two header cells are `Old code` and `New code`. Only pairs of step codes are kept, an unreadable file gives no map, and several sources are read oldest name first and composed (a later source that repeats an old code wins); codes inside one file are not chained, since one file is one renaming. For a run with renames (a `renames` prefix map in its source or a `codeMap`), the lens looks a brief's record up on disk under, in order: its own name; the map; the *Features* table's `Old steps` followed by the map; the `Old steps` alone. The first name that is listed wins. A brief whose record is not listed yet (the listing can lag behind a live spawn) is drawn at its own code when that code's step exists in the run (in its *Features* table or among its records). Otherwise, a brief whose record is no longer on disk gets no chart: it appears only in one collapsed line, `Briefs naming records no longer on disk (n)`, under the charts (not drawn when there is none).
  - Run-state file names are matched in lower case only, as the `handoff` skill and auto-handoff write them (`RUN.V1.MD` and `Run.v1.md` are neither run states nor records). The run state is the highest versioned `run.v<major>.md` or `run.v<major>.<minor>.md` that can be read, else `run.md`: versions are read highest first and reading stops at the first readable one (an unreadable one is skipped), and each read is cached until the file's size or modified time changes. Versions are ordered by major, then minor, numerically (`v2` > `v1.2` > `v1.1` > `v1`, `v1.10` > `v1.9`); a part with a zero or a leading zero (`run.v0.md`, `run.v01.md`, `run.v1.0.md`) is not a version. An older version is deprecated by a newer `.1` minor saying so, never by its own front matter, so the lens reads no deprecation field. Run-state files are never taken for records and never appear as chart nodes.
- **Idle orchestrator.** In a step whose agents have all ended, the orchestrator (the step's root) is drawn idle, not running.
- **Failures stay contained.** A lens error never replaces Claude Code's own Agent row: the card falls back to that row. A pane that fails to draw shows one red line, `lens: the <pane> could not be drawn (…)`, instead of going blank.
- **Live markers.** The ▲ anomaly markers on the chat card and in the `/ai-dlc:lens` pane update while they are shown, and clear when the cause is gone.
- **Pollers.** The lens's blink and poll timers stop when the session ends, but not at `/clear` (no new session start follows a `/clear`, so stopping there would leave the lens without them).

### Full screen

`⤢` brings the pane to the front and shows one step of the selected run alone: a note, a `Runs:` row to switch runs (with several runs), a `Steps:` row to switch steps (with several steps), and the step's chart 1.5 times larger. `⤢` on a step chart picks that step; from the pane's own `⤢` the first step, the highest code, is shown. The run list, notices, keep-alive line and Anomalies section are hidden until `⤡` restores the view.

VS Code sizes its own panel: maximise it for more room. In the terminal, full screen leaves the band for the pane, which is at most 45% wide when docked; restoring returns to the band. No host lets a plugin take the whole window.

## Settings

Every lens setting comes from the first level that holds a valid value: `AI_DLC_LENS_*` in the `env` of `.claude/settings.local.json`, then of `.claude/settings.json`, then `.ai-dlc/lens.json`, then the default; an invalid value is skipped. The process environment is never read. `/ai-dlc:lens-configure` lists them with the level each comes from, and `/ai-dlc:lens-init` writes the file and its schema (`hooks/settings.ts` is the source of this table, which lists its 61 keys and the per-agent `avatarImage.<agent>` pattern). An env name is the key in capitals with `_` between words: `chartMode` is `AI_DLC_LENS_CHART_MODE`.

| Key | Default | Values | What it does |
|---|---|---|---|
| `chartMode` | `auto` | `auto`, `chart`, `button` | Chat card: the chart when the row is wide enough, else a chip with an "Open flowchart" button; `chart` or `button` always that one. |
| `breakpointColumns` | `0` | 0 to 1000 | Row width from which `auto` draws the chart; 0: the chart width divided by `cellPx`. |
| `cellPx` | `8` | 4 to 32 | CSS px per viewport column (no API gives the cell width). |
| `chartColumnPx` | `120` | 60 to 400 | Width of one avatar column, px. |
| `chartRowPx` | `96` | 60 to 400 | Height of one chart level, px. |
| `chartAvatarsPerRow` | `8` | 2 to 24 | **In progress.** The most avatars one chart row holds; a level with more wraps onto further rows. Env: `AI_DLC_LENS_CHART_AVATARS_PER_ROW`. |
| `avatarRadiusPx` | `14` | 6 to 40 | Avatar radius, px. |
| `collapsedByDefault` | `true` | boolean | Every `[+]`/`[-]` section starts collapsed. |
| `blink` | `true` | boolean | Running avatars blink. |
| `blinkMs` | `1000` | 200 to 10000 | One blink cycle, ms. |
| `showCost` | `true` | boolean | Cost line in the agent panel. |
| `cacheWriteRate` | `5m` | `5m`, `1h` | Cache-write price used for cost (the usage does not say the TTL). |
| `windowFallback` | `main` | `main`, `none` | A model missing from the metadata file: use the main session's window when it runs the same model, or show `—`. |
| `costingPath` | `.ai-dlc/model-metadata.json` | path | Model metadata: prices, windows, limits (read only). |
| `costingFallbackPath` | `.ai-dlc/model-costing.json` | path | Read when `costingPath` is missing (the file's name before the rename). |
| `rosterPath` | `.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md` | path | Team roster (agent ID to persona name). |
| `contextLimit` | `60` | 1 to 1000 | Gathered-context calls kept for the main loop. |
| `callsLimit` | `80` | 1 to 1000 | Tool calls kept per agent. |
| `callsShown` | `40` | 1 to 1000 | Tool calls listed in the agent panel. |
| `recordChars` | `6000` | 200 to 200000 | Characters shown of a handoff record or hand-back. |
| `thinkingChars` | `4000` | 200 to 200000 | Characters of thinking kept per agent. |
| `longContextThresholdTokens` | `0` | 0 to 100000000 | Overrides every model's long-context threshold for cost; 0: the metadata file decides. |
| `statusBlink` | `true` | boolean | The in-progress status indicator blinks. |
| `statusBlinkMs` | `1000` | 200 to 10000 | One status blink cycle, ms. |
| `statusInProgressColor` | `#2e7d32` | hex colour | In progress (blinks). |
| `statusPendingColor` | `#cfd8dc` | hex colour | Pending. |
| `statusHaltedColor` | `#c62828` | hex colour | Halted. |
| `statusWaitingColor` | `#ef6c00` | hex colour | Waiting. |
| `statusCompletedColor` | `#2e7d32` | hex colour | Completed (steady). |
| `avatarStyle` | `robot` | `robot`, `image`, `initials` | See *Avatars* below. |
| `avatarImageTypes` | `image/png` | list of `image/png`, `image/jpeg`, `image/gif`, `image/webp` | Allowed image types, comma-separated; checked on the bytes. |
| `avatarImageMaxBytes` | `65536` | 1 to 2097152 | Largest avatar image, bytes. |
| `keepaliveSection` | `true` | boolean | The Cache keep-alive section of the agent panes (`/ai-dlc:lens-keepalive` toggles it). |
| `panelOpenMode` | `drill-in` | `tab`, `drill-in` | How an avatar or arrow opens its details: inside the pane or card it was pressed in (`drill-in`), or as a separate pane (`tab`). The Panel Type switch overrides it for the session only and never writes `lens.json`. |
| `chartInChat` | `true` | boolean | Draw each workflow's chart in the card of its first spawn. |
| `chartInPane` | `true` | boolean | Draw the charts in the workflow view; off: the avatar and arrow buttons only. |
| `workflowPlace` | `pinned` | `pinned`, `docked` | Where the view starts: the band above the prompt where the surface has one (terminal, desktop app), else the pane; `docked`: the pane. |
| `wideColumns` | `70` | 0 to 1000 | View width from which the wide layout applies. |
| `runListColumns` | `34` | 16 to 200 | Width of the stacked run panels in the wide layout. |
| `gateAlert` | `true` | boolean | Report anomalies: a toast when one appears, a marker, and the Anomalies section. `false` turns all reporting off. `/ai-dlc:lens-gate on\|off` sets it. |
| `anomalyRunScope` | `session` | `session`, `all` | Which runs the detector reads: those this session's agent briefs name, or (`all`) also every active or blocked `run.md` under `artifacts.handoffs` of `.ai-dlc/workflow.json` (default `docs/handoffs`). |
| `anomalyWaitingMinutes` | `30` | 0 to 1440 | How long an agent may wait before it is an anomaly, minutes; 0: as soon as it waits. |
| `anomalyRunBlocked` | `true` | boolean | Check: a run is blocked (`status: blocked` in its `run.md`); the anomaly names its blocked steps. |
| `anomalyRunBlockedColor` | `#c62828` | hex colour | Marker colour: blocked run (red). |
| `anomalyStepBlocked` | `true` | boolean | Check: a *Stages* row of `run.md` has a status starting with `blocked`, whatever the run's status. |
| `anomalyStepBlockedColor` | `#c62828` | hex colour | Marker colour: blocked step (red). |
| `anomalyGateWaiting` | `true` | boolean | Check: a gate waits for the human (a gate row with approver `human` and no decision, or the run's newest record addressed `to: human` with no decision for its gate). A decision in words with a date is not waiting (**in progress**, see [Anomaly alert](#anomaly-alert)). |
| `anomalyGateWaitingColor` | `#ef6c00` | hex colour | Marker colour: gate waiting (orange). |
| `anomalyGateRejected` | `true` | boolean | Check: a gate was rejected (the last row of that gate in *Gates and loops* says rejected, not approved, declined or no-go). |
| `anomalyGateRejectedColor` | `#c62828` | hex colour | Marker colour: gate rejected (red). |
| `anomalyLoopOutOfRounds` | `true` | boolean | Check: a loop is out of rounds (its last row in *Gates and loops* says its limits are used up, with no raise or acceptance recorded). |
| `anomalyLoopOutOfRoundsColor` | `#d84315` | hex colour | Marker colour: loop out of rounds (deep orange). |
| `anomalyAgentFailed` | `true` | boolean | Check: an agent failed or stopped, and no later agent of its type was spawned for the same run. |
| `anomalyAgentFailedColor` | `#c62828` | hex colour | Marker colour: agent failed or stopped (red). |
| `anomalyAgentKilled` | `true` | boolean | Check: an agent was killed, and no later agent of its type was spawned for the same run. |
| `anomalyAgentKilledColor` | `#c62828` | hex colour | Marker colour: agent killed (red). |
| `anomalyAgentWaitingLong` | `true` | boolean | Check: an agent has waited (held, or a teammate idle) for `anomalyWaitingMinutes` or more. |
| `anomalyAgentWaitingLongColor` | `#c62828` | hex colour | Marker colour: agent waiting too long (red). |
| `anomalyHandbackFailed` | `true` | boolean | Check: a hand-back failed its check (`verification: failed` in its front matter, or a first line `handoff <file>: failed`), in the newest round of its step. |
| `anomalyHandbackFailedColor` | `#f9a825` | hex colour | Marker colour: hand-back that failed its check (yellow). |
| `probes` | `false` | boolean | Log the spike's experiments E1, E2, E4, E5, E7, E9 and E10 to `PROBE-LOG.jsonl` in the plugin folder (diagnostics). |
| `avatarImage.<agent>` | unset | `data:` URI or file path | One agent's image. Env: `AI_DLC_LENS_AVATAR_IMAGE__<AGENT>`. |

### Avatars

Each agent is drawn as a robot, the same robot for every agent of a type (`hooks/avatar.ts`), with its status as the ring around it. `avatarStyle` is `robot` (default), `image` or `initials`. `avatarImage.<agent>` sets an agent's image: a `data:` URI, or a path to an image file inside a folder Claude Code trusts (`projects` in `~/.claude.json`); anything else, a remote URL included, is refused and never fetched. `<agent>` is the agent ID for an ai-dlc agent (`avatarImage.software-engineer`), else the whole agent type; its env name is `AI_DLC_LENS_AVATAR_IMAGE__<AGENT>` (capitals, `:` as `__`, `-` and `.` as `_`). `avatarImageTypes` (default `image/png`) and `avatarImageMaxBytes` (default 65,536) limit images, and an image that would push the chart past the 131,072-character Svg limit is left out with a note. `/ai-dlc:lens-configure` refuses an untrusted path.

## Anomaly alert

The lens reads each run's `run.md` (front matter, *Stages* and *Gates and loops* tables), the handoff records and hand-backs in the run folder, and the agents it tracks, and reports an anomaly once when it appears and clears it when its cause is gone. A malformed file is skipped, never an error. Done and abandoned runs report nothing. There is no command Stop hook and no marker file.

| Anomaly | Colour (setting) |
|---|---|
| A run is blocked (`status: blocked` in `run.md`); it names its blocked steps | red (`anomalyRunBlockedColor`) |
| A step is blocked (a *Stages* row whose status starts with `blocked`), even while the run is active | red (`anomalyStepBlockedColor`) |
| A gate waits for the human | orange (`anomalyGateWaitingColor`) |
| A gate was rejected | red (`anomalyGateRejectedColor`) |
| A loop is out of rounds | deep orange (`anomalyLoopOutOfRoundsColor`) |
| An agent failed or stopped | red (`anomalyAgentFailedColor`) |
| An agent was killed, or waited `anomalyWaitingMinutes` (default 30) or more | red (`anomalyAgentKilledColor`, `anomalyAgentWaitingLongColor`) |
| A hand-back failed its check | yellow (`anomalyHandbackFailedColor`), a marker on its record's arrow |

**In progress:** a gate row whose decision is written in words and has a date is decided, not waiting. "Gate waiting" is still raised for an empty or dash decision, a `pending`, `waiting`, `open`, `tbd`, `todo` or "not yet" decision, or a missing date.

Each is shown as a toast with the ▲ marker and in the **Anomalies (n)** section of the workflow view. Every check has its own on/off setting and colour (see the [Settings](#settings) table); `gateAlert` `false` turns all reporting off. A run reported blocked names its blocked steps instead of repeating them; with `anomalyRunBlocked` off, the steps are reported on their own. A blocked step's record is read from the *Stages* table's `Record` column, else its `Handback` column, else its `Handoff` column.

`anomalyRunScope` chooses the runs read: `session` (default) reads the runs this session's agent briefs name; `all` also reads every active or blocked `run.md` under `artifacts.handoffs` (default `docs/handoffs`). Bare `/ai-dlc:lens-gate` ends with the runs it read and the scope in force. Change it with `/ai-dlc:lens-configure anomalyRunScope all`, or set `AI_DLC_LENS_ANOMALY_RUN_SCOPE` in a settings file's `env`.

## Develop

From the repository root:

```text
npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc-lens
npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens
```

`tsc` needs the Claude Code engine types, which are not committed. Copy `types/claude-code.d.ts` from the `plugin-authoring` skill bundled with your Claude Code build (written under the temp folder `claude/bundled-skills/<version>/<hash>/plugin-authoring/` when that skill loads) to `.tsc/claude-code.d.ts`, then run `npx -p typescript@5 tsc -p plugins/claude/ai-dlc-lens/.tsc`.

[MANUAL-CHECKS.md](MANUAL-CHECKS.md) is the list of checks to run by hand in VS Code and the terminal: what the headless tests cannot show.

## Licence

MIT, see [LICENSE](LICENSE). Third-party code: see [NOTICE.md](NOTICE.md).
