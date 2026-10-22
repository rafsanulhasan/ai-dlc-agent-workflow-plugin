# Spike 028: can a separate mod plugin read ai-dlc keep-alive's state?

Claude Code 2.1.308, Windows 11, 2026-10-23. Throwaway code only: nothing under `plugins/`, `tools/`, `tests/` or `docs/` changed. It is deleted before the lens PR leaves draft.

`<REPO>` is the main checkout of this repository, the folder registered as the `ai-dlc-agent-workflow` marketplace (`CLAUDE.md`), switched to the `feat/ai-dlc-lens` branch. `<SPIKES>` = `<REPO>\spikes\ai-dlc-lens`; `<SPIKE>` = `<SPIKES>\028`, this folder.

## Layout

- `spike028-ka/`: the provider, a fake keep-alive. It arms a 1h and a 5m track at `session.start` and pings every 4 s, three pings at most. It exposes the same state, shaped like keep-alive's `Track` plus its settings (`types/index.d.ts`), in three ways:
  - `$.state` `{ plugin: 'spike028-ka', key: 'keepalive' }`, with its contract in `types/index.d.ts`;
  - the tool `mcp__spike028-ka__keepalive_state` (`$.tool.register`, `isDeferred: true`), answered by its own `tool.call` hook. When `flags.json` in this folder has `allowOwnTool: true`, a `tool.check` hook also allows the tool;
  - the state file `state/keepalive.json` in this folder (`$.fs.write`).
- `spike028-lens/`: the reader. At `prompt.submit` and `classic.Stop` it reads the state through `$.state.get`, `$.tool.list`, `$.tool.check`, `$.tool.call` and `$.fs.read`, and writes what each one returned to `results/<site>-<ms>.json` in this folder.
  - `/spike028-probe` runs the same reads on demand.
  - `/spike028-lens` opens a pane that draws one keep-alive line from the provider's `$.state` value.
  - `tests/pane.test.tsx` is the kit test for that pane.
- `flags.json`, `state/` and `results/` are written at run time and not committed (`<SPIKES>\.gitignore`). Without `flags.json`, `allowOwnTool` is `false`.

Both plugins find this folder by stripping their own folder name from their root. Loaded with `--plugin-dir`, they share `state/`, `results/` and `flags.json` here. Installed from the marketplace, each runs from its own installed copy, so the state-file route cannot be shared and `results/` lands beside the installed copy: use the `--plugin-dir` route for anything that reads those files. The `$.state` and tool routes do not use files.

## Automatic runs (done)

Recorded in the first location, where the two plugins sat under `plugins/` (now this folder). The commands assumed Git Bash. The recorded output (`results/run1..run6/`, `logs/`) is not committed; the table holds what it showed.

| Run | Command (now from `<SPIKE>`) | Result |
|---|---|---|
| validate | `claude plugin validate <p>` | Both plugins pass. The lens reports `state reads: spike028-ka.keepalive` and `state of other plugins, not checked`. |
| 1 | `claude -p "Reply with the single word ok." --model haiku --plugin-dir .` | `$.state` read works. The tool call reached the provider's hook, but an object result was refused ("expected string … array"); a tool result must be a string or content blocks. `$.tool.check` needs `{ tool, input }`. |
| 2 | the same, with prompt `Run the Bash command: sleep 8 …` and `--allowedTools "Bash(sleep:*)"` | All three routes return the state. At prompt.submit: version 1, 0 pings. At Stop: version 4, 3 pings, tracks stopped. `tool.check` = `ask`, yet `tool.call` was answered: the debug log says "answered tool.call without next() … nothing beneath it ran", so the permission check never ran. |
| 3 | run 1 with `flags.json` = `{ "allowOwnTool": true }` | `tool.check` = `allow` with the provider's reason. |
| 4 | run 1 without `dependencies` in the lens `plugin.json` | The `$.state` read still works: `dependencies` is not needed at run time. |
| 5 | `--plugin-dir spike028-lens` only, with `dependencies: ["spike028-ka"]` | The lens does not load: `dependency-unsatisfied`, `Dependency "spike028-ka" is not installed`. |
| 6 | run 5 without `dependencies` | It degrades cleanly. `$.state.get` gives `{ version: 0 }` with no value. `tool.call` and `tool.check` reject with `no tool named …`. `fs.read` fails with ENOENT. |
| kit | `claude plugin test spike028-lens` | Passes on the terminal and desktop surfaces. An inline plugin named `spike028-ka` writes its `$.state`, the lens pane draws `keep-alive: 5m next ping in 120s (every 240s, 1/12)`, and after the provider's next write it draws `keep-alive: off`. |

Validate (both plugins) and the kit test were re-run from `spikes/ai-dlc-lens/028/` on the branch, with the same results.

A `$.state` read sees one moment per dispatch. Two `get`s 5 s apart inside the same `prompt.submit` hook returned the same version (run 2, `state` and `stateLater`). A reader sees new values from its next dispatch on, for example its next draw.

## Install

Main route: the repository's own marketplace, `ai-dlc-agent-workflow`, read from `<REPO>`, which must be on `feat/ai-dlc-lens`.

1. In a terminal at `<REPO>`: `claude plugin marketplace update ai-dlc-agent-workflow`, then `claude plugin install spike028-ka@ai-dlc-agent-workflow --scope local` and `claude plugin install spike028-lens@ai-dlc-agent-workflow --scope local`. The lens lists `spike028-ka` under `dependencies`, so install the provider too.
2. Run `/reload-plugins` in an open Claude Code session, or open a new one (VS Code or terminal).

The installed copies do not follow edits under `<SPIKE>`: after a change, uninstall and install again (the version stays `0.1.0`), then `/reload-plugins`.

Terminal: `claude --plugin-dir "<SPIKE>"` loads both plugins (a folder of plugins loads each child) for that session only, with nothing installed. This is the route the manual check below uses.

Alternative, only if the marketplace route fails: add `"CLAUDE_CODE_PLUGIN_DIRS": "<SPIKE>\\spike028-ka;<SPIKE>\\spike028-lens"` to the `env` block of `~/.claude/settings.json` (user settings only; each `\` written as `\\`), restart, and remove the entry afterwards.

## Manual check (needs a person, an interactive terminal of 110 or more columns)

1. Run `claude --plugin-dir "<SPIKE>"`. Do not have the marketplace copies enabled at the same time, or each plugin loads twice; uninstall them first, or use the installed copies instead of this command.
2. Type `/spike028-lens`. A pane "Keep-alive (spike 028)" opens.
3. Expected: the line counts down `next ping in Ns` and `ping n/3` rises every 4 s, `state version` rises with each ping, and after the third ping the line reads `keep-alive: off`. The pane redraws with no input, because a `$.state` read in a render subscribes the pane.
   - The provider's timer starts at `session.start`, so open the pane within about 12 s. Otherwise you see only the final state, unless you `/reload-plugins`.
4. Optional: `/spike028-probe` prints the five reads. With no `flags.json` (or `allowOwnTool: false`), confirm that no permission dialog opens for the tool call. Runs 2 and 3 showed the provider's hook answers before the permission check, but only in `-p` mode.
5. Optional, not verified yet: repeat steps 2 and 3 with the two installed copies (marketplace route) to see whether `$.state` reads work the same in an installed plugin as with `--plugin-dir`.

## Teardown

```text
claude plugin uninstall spike028-lens@ai-dlc-agent-workflow --scope local
claude plugin uninstall spike028-ka@ai-dlc-agent-workflow --scope local
```

Uninstall `spike028-lens` before `spike028-ka`: the lens lists the provider under `dependencies`, so uninstalling the provider first warns that it is required by `spike028-lens`. Keep the `ai-dlc-agent-workflow` marketplace; it also serves `ai-dlc`. Delete `flags.json`, `state/` and `results/` in this folder if a `--plugin-dir` run wrote them; they are gitignored.
