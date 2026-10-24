---
name: lens-configure
description: "Shows the lens settings, each with its value, where it comes from and its env name, or sets or unsets one in .ai-dlc/lens.json (needs the ai-dlc-lens plugin). /ai-dlc:lens-configure [<key> [<value>|--unset]]."
argument-hint: "[<key> [<value>|--unset]]"
disable-model-invocation: true
---

# Configure the lens

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

In Claude Code the `ai-dlc-lens` plugin's hooks module answers `/ai-dlc:lens-configure` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens-configure` | Lists every setting: its value, the level it comes from, its env name and its default, then any value that was ignored |
| `/ai-dlc:lens-configure <key>` | Shows one setting |
| `/ai-dlc:lens-configure <key> <value>` | Sets it in `.ai-dlc/lens.json`, and names the level that still wins when a higher one holds it |
| `/ai-dlc:lens-configure <key> --unset` | Removes it from `.ai-dlc/lens.json` |

Each setting comes from the first level that holds a valid value: `AI_DLC_LENS_*` in the `env` of `.claude/settings.local.json`, then of `.claude/settings.json`, then `.ai-dlc/lens.json`, then the default. The process environment is never read. An `avatarImage.<agent>` path outside every folder Claude Code trusts is refused and never written.

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never change a settings file yourself.
