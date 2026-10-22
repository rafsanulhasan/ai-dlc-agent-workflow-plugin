# ai-dlc-lens spikes (throwaway)

Throwaway spike plugins for the run `FEAT-20261020-ai-dlc-lens`. They answer, by hand checks in VS Code and the terminal, the questions the lens design (ITEM-005) needs answered before G2. They are not plugin source and are deleted before the lens PR leaves draft.

| Folder | Plugin | Work item | Question |
|---|---|---|---|
| `027/` | `ai-dlc-lens-spike-027` | ITEM-027 | VS Code pane: resize at the dock boundary, Svg blink, buttons, transcript cards, Stop `systemMessage` alert |
| `028/spike028-ka/` | `spike028-ka` | ITEM-028 | provider: a fake keep-alive that publishes its state |
| `028/spike028-lens/` | `spike028-lens` | ITEM-028 | reader: can another plugin read keep-alive's state (`$.state`, a tool, a file) |
| `029/` | `spike029-avatars` | ITEM-029 | avatar images and the Svg scrub in the mod pane |

`.claude-plugin/marketplace.json` is one local marketplace, `ai-dlc-lens-spikes`, that lists all four.

## Install all

`<SPIKES>` is this folder in your checkout of `feat/ai-dlc-lens`.

```text
claude plugin marketplace add "<SPIKES>"
claude plugin install ai-dlc-lens-spike-027@ai-dlc-lens-spikes --scope user
claude plugin install spike028-ka@ai-dlc-lens-spikes --scope user
claude plugin install spike028-lens@ai-dlc-lens-spikes --scope user
claude plugin install spike029-avatars@ai-dlc-lens-spikes --scope user
```

Then open a new Claude Code session in VS Code, or run `/reload-plugins` in an open one. The commands are `/spike027`, `/spike027-gate`, `/spike028-lens`, `/spike028-probe`, `/spike029` and `/spike029-overcap`.

For one session in the terminal without installing: `claude --plugin-dir "<SPIKES>\027"` (likewise `028`, which loads both of its plugins, and `029`). Each `CHECK.md` also gives the `CLAUDE_CODE_PLUGIN_DIRS` alternative, which you set and remove yourself.

## Order of checks

1. `027/CHECK.md`: checks 1–5. Check 1 (does the pane redraw on resize) decides how much of the rest of the lens design holds.
2. `029/CHECK.md`: VS Code rows 1–23, then terminal rows 24–27.
3. `028/CHECK.md`: the manual check, from the terminal with `--plugin-dir`.

## Recording results

Write each result (works, does not work, partly works, with a screenshot or the line you saw) next to its check number in that spike's `CHECK.md`, in the Result column where there is one. Note the VS Code extension version and, for terminal checks, the terminal emulator. Then tell the orchestrator; the software-architect cites the results in the spec (ITEM-005).

## Tests and typecheck

From this folder:

```text
claude plugin validate .
claude plugin validate 027
claude plugin test 027
claude plugin test 028/spike028-lens
claude plugin test 029
```

`tsc` needs the Claude Code engine types, which are not committed (as in the rest of this repository). Copy `types/claude-code.d.ts` from the `plugin-authoring` skill bundled with your Claude Code build into `027/.tsc/` and `029/typecheck/`, then run `npx -p typescript@5 tsc -p 027/.tsc` and `npx -p typescript@5 tsc -p 029/typecheck`. The copies are gitignored.

Run-time output (`027/GATE-ALERT.txt`, `028/flags.json`, `028/state/`, `028/results/`) is gitignored too.

## Teardown

```text
claude plugin uninstall ai-dlc-lens-spike-027@ai-dlc-lens-spikes
claude plugin uninstall spike028-lens@ai-dlc-lens-spikes
claude plugin uninstall spike028-ka@ai-dlc-lens-spikes
claude plugin uninstall spike029-avatars@ai-dlc-lens-spikes
claude plugin marketplace remove ai-dlc-lens-spikes
```

Remove any `CLAUDE_CODE_PLUGIN_DIRS` entry you added.
