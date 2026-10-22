---
name: cache-keepalive-install
description: "Creates .ai-dlc/cache-keepalive.json with every key at its default, and its schema, on first use; an existing file is left alone (use /ai-dlc:cache-keepalive-merge). Claude Code only."
disable-model-invocation: true
---

# Install keep-alive's settings

Creates `.ai-dlc/cache-keepalive.json`, the team's keep-alive settings, committed with the repository, and `.ai-dlc/cache-keepalive.schema.json` next to it. `/ai-dlc:init` runs this skill when the file does not exist yet.

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that these settings do not apply there and stop.

`<configure dir>` below is the `cache-keepalive-configure` skill's folder, `${CLAUDE_SKILL_DIR}/../cache-keepalive-configure`, which holds the CLI and documents every key, where each value comes from and workspace trust (its `SKILL.md`). Run the CLI from the repository root.

1. Run `node <configure dir>/templates/cache-keepalive.mjs install --dry-run`.
   - When it prints `warning: .ai-dlc/cache-keepalive.json already exists: run /ai-dlc:cache-keepalive-merge …`, say that the file is already there, that `/ai-dlc:cache-keepalive-merge` brings it up to date and `/ai-dlc:cache-keepalive-configure` shows and changes it, and stop: nothing is written.
   - Otherwise it says it creates the file with every key at its default, and the schema. Show the lines.
2. With consent, run it again without `--dry-run`.
3. Apply the values the caller passed (for `init`, `oneHour.keepWarmFor` and `scope`) as the `cache-keepalive-configure` skill's **change** mode does from step 4: the preview, then the write after consent. A track's `maxPings` follows the keep-warm time written for it.

Every key now holds an explicit value written from this plugin version's defaults; a later change of a default in the plugin does not reach a key already written. `/ai-dlc:cache-keepalive-configure` changes a value.

Done when `node <configure dir>/templates/cache-keepalive.mjs validate` prints no warning for `.ai-dlc/cache-keepalive.json`, or the file already existed (step 1).
