# ITEM-027 spike (a): manual check in VS Code

Throwaway mod plugin `ai-dlc-lens-spike-027`. It is not plugin source: it is deleted before the lens PR leaves draft. The software-architect cites the results in the spec (ITEM-005).

`<REPO>` is your checkout of the `feat/ai-dlc-lens` branch (for example its worktree folder). `<SPIKES>` = `<REPO>\spikes\ai-dlc-lens`, the marketplace folder; `<SPIKE>` = `<SPIKES>\027`, this plugin.

## What was checked automatically (2026-10-23, Claude Code 2.1.308)

- `claude plugin validate <SPIKE>`: passed with warnings (no author, no icon). The module hooks `session.start`, two `command.run`, `ui.render` for `Pane`, `ToolUse` and `ToolResult`, and `classic.Stop`.
- `tsc -p <SPIKE>\.tsc` (TypeScript 5.6, this build's `claude-code.d.ts`): no errors. The types file is not committed; see `<SPIKES>\README.md` to copy it in before running `tsc`.
- `claude plugin test <SPIKE>`: 3 passed, 0 failed (`tests/spike.test.tsx`), on the `terminal` and `vscode` surfaces of the test kit. The kit checks the trees the hooks return. It does not draw anything, so every check below still needs a person to look at VS Code.
- Headless load (run once from the first location; its output files are not committed): `claude -p --setting-sources user --plugin-dir <SPIKE> --output-format stream-json --verbose`. The module loaded and registered `spike027` and `spike027-gate`. With the marker `on`, the stream had `{"subtype":"informational","content":"Stop says: ai-dlc-lens spike: gate alert test (5a, command Stop hook systemMessage)","level":"notice"}` and `{"subtype":"ui_toast","plugin":"ai-dlc-lens-spike-027",...}`. With the marker `off`, neither appeared.

Validate and test were re-run from `spikes/ai-dlc-lens/027/` on the branch, with the same results.

## Install (VS Code, Claude Code 2.1.299 or later)

Main route: the spikes' local marketplace, `ai-dlc-lens-spikes`.

1. In a terminal: `claude plugin marketplace add "<SPIKES>"`, then `claude plugin install ai-dlc-lens-spike-027@ai-dlc-lens-spikes --scope user`.
2. In VS Code, open a new Claude Code session, or run `/reload-plugins` in an open one.
3. Type `/spike027`. The pane "Lens spike 027" opens.

The installed copy does not follow edits under `<SPIKE>`: after a change, uninstall and install it again (the version stays `0.1.0`), then `/reload-plugins`.

Terminal: `claude --plugin-dir "<SPIKE>"` loads the folder for that session only, with nothing installed.

Alternative, only if the marketplace route fails: the plugin folder variable. You set it and you remove it; nothing is installed.

1. Add `"CLAUDE_CODE_PLUGIN_DIRS": "<SPIKE>"` to the `env` block of `~/.claude/settings.json`, with each `\` written as `\\` (user settings only; project settings are not read for it).
2. Quit VS Code, start it again, and open a new Claude Code session. Type `/spike027`.
3. Afterwards, remove the entry.

If any hook fails, VS Code shows a dim transcript line `ai-dlc-lens-spike-027: ...`. Copy that line into the result.

## Teardown

```text
claude plugin uninstall ai-dlc-lens-spike-027@ai-dlc-lens-spikes
claude plugin marketplace remove ai-dlc-lens-spikes
```

Remove the marketplace only after uninstalling every spike plugin from it (see `<SPIKES>\README.md`). If you used the alternative, remove the `CLAUDE_CODE_PLUGIN_DIRS` entry.

## Manual checks

Write the outcome of each check (works, does not work, or partly works) next to its number, with a screenshot or the line you saw.

### 1. Resize across the dock boundary (AC-12.10)

Steps:

1. Open the pane with `/spike027`.
2. Drag the Claude Code panel from narrow (about 500 px) to wide (more than 1000 px), then back, crossing 800 px each time.
3. Each time, read section [1].

Expected: `placement` switches between `inline` and `dock`. The drawing switches between `COMPACT` and `FLOWCHART`. Each resize adds a line to the redraw log, with the new `bodyColumns`. The width is shown in cells: VS Code gives the pane no pixel width.

What each outcome means:

- **Works:** the pane redraws by itself when its width changes. The design can switch between compact and flowchart from `placement` and `bodyColumns`.
- **Does not work** (no new log line, or `placement` stays the same until something else redraws): the design falls back to a user toggle. Press `auto`, `compact` and `flowchart` and check that each one redraws at once; that toggle is the fallback.
- **Partly works** (the pane redraws only on some resizes, or `placement` changes but `bodyColumns` does not): record which.

### 2. Svg animation

Steps: watch section [2] for 10 seconds.

Expected:

- A (SMIL, `isInteractive`) fades in and out about once a second.
- B (timer) switches between green and grey twice a second.
- C stays green.
- D (text) switches between `●` and `○`.

What each outcome means:

- **A blinks:** the blink can be SMIL, with no timer.
- **Only B blinks:** use the timer path, `$.clock.every`. Redraws are throttled to 10 per second.
- **Neither blinks, or C is not green:** Svg is not usable in VS Code. Use Text glyphs (D). Record whether D blinks.

### 3. Buttons

Steps:

1. In section [3], click `[+]`. Click it again.
2. Run check 4 to get a card in the transcript, then click the card's `[+]`.

Expected: the label switches between `[+]` and `[-]` and `presses=` goes up by one on every click. In the pane, "expanded content..." appears and disappears. On the card, "input keys: ..." appears and disappears.

What each outcome means:

- **Pane and row both work:** expand and collapse are possible in both places.
- **Pane only:** cards cannot expand. Show the details in the pane instead.
- **Neither works:** use the keyboard: Tab to the button, then Enter. Record whether that works.

### 4. Transcript cards (the native response is never hidden)

Steps:

1. In the session, type: `Use the Explore agent to list the files in the hooks folder of this plugin, then reply DONE.`
2. Optional, for teammates: run a prompt that makes Claude use `SendMessage`.

Expected: the `Agent` call row is drawn inside a rounded card that starts `LENS CARD Agent -> <type> (running)` and changes to `(done)`. The native row is inside the card, below the header. The subagent's result row under it is unchanged. The full response is still visible after expanding with ctrl+o, or the native expand in VS Code. Section [4] of the pane counts the cards drawn and the ToolResult rows passed through.

What each outcome means:

- **Works:** cards can be drawn at `ToolUse` with the native row nested, and `next(e)` at `ToolResult` keeps the response.
- **The card shows but the native row or the response is missing:** blocker. The design must not replace the row. Use a header drawn above the row without nesting, or a pane-only view.
- **No card** (VS Code draws its own row): VS Code does not take rewrites at this site. Record any "From the ... plugin" or "Edited by the ... plugin" label you see.

### 5. Gate alert: `Stop` hook `systemMessage` (A14)

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

- `.claude-plugin/plugin.json`: the manifest. The marketplace is `<SPIKES>\.claude-plugin\marketplace.json`, shared by all four spike plugins.
- `hooks/hooks.json`: the module and the command `Stop` hook.
- `hooks/register.tsx`: the hooks module, with sections 1 to 5.
- `scripts/gate-alert.mjs`: check 5a.
- `types/index.d.ts`: the `$.state` contract.
- `tests/spike.test.tsx`: tests for checks 1, 3 and 4 in the test kit.
- `.tsc/tsconfig.json`: the tsconfig for `tsc`.
- `GATE-ALERT.txt`: the check 5 marker, written at run time by `/spike027-gate` and not committed.
