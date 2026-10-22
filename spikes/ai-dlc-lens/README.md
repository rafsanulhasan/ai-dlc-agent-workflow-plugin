# ai-dlc-lens spikes (throwaway)

Throwaway spike plugins for the run `FEAT-20261020-ai-dlc-lens`. They answer, by hand checks in VS Code and the terminal, the questions the lens design (ITEM-005) needs answered before G2. They are not plugin source and are deleted before the lens PR leaves draft.

| Folder | Plugin | Work item | Question |
|---|---|---|---|
| `027/` | `ai-dlc-lens-spike-027` | ITEM-027 | VS Code pane: resize at the dock boundary, Svg blink, buttons, transcript cards, Stop `systemMessage` alert |
| `028/spike028-ka/` | `spike028-ka` | ITEM-028 | provider: a fake keep-alive that publishes its state |
| `028/spike028-lens/` | `spike028-lens` | ITEM-028 | reader: can another plugin read keep-alive's state (`$.state`, a tool, a file) |
| `029/` | `spike029-avatars` | ITEM-029 | avatar images and the Svg scrub in the mod pane |

All four are listed in the repository's own marketplace, `ai-dlc-agent-workflow` (`.claude-plugin/marketplace.json` at the repository root), after `ai-dlc`. They are Claude Code mods, so the Copilot marketplace does not list them.

## Install all

The `ai-dlc-agent-workflow` marketplace is read from the main checkout of this repository (the folder registered with `claude plugin marketplace add ./ --scope local`, see `CLAUDE.md`), so that checkout must be on `feat/ai-dlc-lens`. `<SPIKES>` is `spikes\ai-dlc-lens` in that checkout. From the repository root:

```text
claude plugin marketplace update ai-dlc-agent-workflow
claude plugin install ai-dlc-lens-spike-027@ai-dlc-agent-workflow --scope local
claude plugin install spike028-ka@ai-dlc-agent-workflow --scope local
claude plugin install spike028-lens@ai-dlc-agent-workflow --scope local
claude plugin install spike029-avatars@ai-dlc-agent-workflow --scope local
```

Then run `/reload-plugins` in an open Claude Code session, or open a new one in VS Code. The commands are `/spike027`, `/spike027-gate`, `/spike028-lens`, `/spike028-probe`, `/spike029` and `/spike029-overcap`.

For one session in the terminal without installing: `claude --plugin-dir "<SPIKES>\027"` (likewise `028`, which loads both of its plugins, and `029`). Each `CHECK.md` also gives the `CLAUDE_CODE_PLUGIN_DIRS` alternative, which you set and remove yourself.

## Order of checks

1. `027/CHECK.md`: checks 1–5. Check 1 (does the pane redraw on resize) decides how much of the rest of the lens design holds.
2. `029/CHECK.md`: VS Code rows 1–23, then terminal rows 24–27.
3. `028/CHECK.md`: the manual check, from the terminal with `--plugin-dir`.

## Recording results

Write each result (works, does not work, partly works, with a screenshot or the line you saw) next to its check number in that spike's `CHECK.md`, in the Result column where there is one. Note the VS Code extension version and, for terminal checks, the terminal emulator. Then tell the orchestrator; the software-architect cites the results in the spec (ITEM-005).

## Tests and typecheck

From this folder (the marketplace, with the spikes in it, is validated from the repository root with `npx @anthropic-ai/claude-code plugin validate --strict .`):

```text
claude plugin validate 027
claude plugin validate 028/spike028-ka
claude plugin validate 028/spike028-lens
claude plugin validate 029
claude plugin test 027
claude plugin test 028/spike028-lens
claude plugin test 029
```

`tsc` needs the Claude Code engine types, which are not committed (as in the rest of this repository). Copy `types/claude-code.d.ts` from the `plugin-authoring` skill bundled with your Claude Code build into `027/.tsc/` and `029/typecheck/`, then run `npx -p typescript@5 tsc -p 027/.tsc` and `npx -p typescript@5 tsc -p 029/typecheck`. The copies are gitignored.

Run-time output (`027/GATE-ALERT.txt`, `028/flags.json`, `028/state/`, `028/results/`) is gitignored too.

## Teardown

```text
claude plugin uninstall ai-dlc-lens-spike-027@ai-dlc-agent-workflow --scope local
claude plugin uninstall spike028-lens@ai-dlc-agent-workflow --scope local
claude plugin uninstall spike028-ka@ai-dlc-agent-workflow --scope local
claude plugin uninstall spike029-avatars@ai-dlc-agent-workflow --scope local
```

Uninstall `spike028-lens` before `spike028-ka`: the lens lists the provider under `dependencies`, so uninstalling the provider first warns that it is required by `spike028-lens`. Keep the `ai-dlc-agent-workflow` marketplace; it also serves `ai-dlc`. Remove any `CLAUDE_CODE_PLUGIN_DIRS` entry you added.
