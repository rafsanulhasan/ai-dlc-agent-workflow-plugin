---
name: lens-init
description: "Writes the lens settings file .ai-dlc/lens.json with every default, and its schema .ai-dlc/lens.schema.json (needs the ai-dlc-lens plugin). An existing file is kept unless --force is given. /ai-dlc:lens-init [--force]."
argument-hint: "[--force]"
disable-model-invocation: true
---

# Lens settings file

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

In Claude Code the `ai-dlc-lens` plugin's hooks module answers `/ai-dlc:lens-init` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens-init` | Writes `.ai-dlc/lens.json` with every default and `.ai-dlc/lens.schema.json`. When `.ai-dlc/lens.json` exists it is kept and only the schema is written |
| `/ai-dlc:lens-init --force` | Resets `.ai-dlc/lens.json` to the defaults, and writes the schema |

It names any setting that a `AI_DLC_LENS_*` entry in the `env` of `.claude/settings.local.json` or `.claude/settings.json` still overrides. `/ai-dlc:lens-configure` shows and changes the values.

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never write the settings file yourself.
