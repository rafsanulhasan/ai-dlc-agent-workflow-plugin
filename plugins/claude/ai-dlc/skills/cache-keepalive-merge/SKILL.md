---
name: cache-keepalive-merge
description: "Brings .ai-dlc/cache-keepalive.json up to date after a plugin upgrade, or repairs it (Claude Code only). It adds new keys, rewrites null and legacy values to their defaults, removes retired keys and keeps every value set; without a file, use /ai-dlc:cache-keepalive-install."
disable-model-invocation: true
---

# Merge keep-alive's settings

Brings an existing `.ai-dlc/cache-keepalive.json` up to date with this plugin version, or repairs it, and refreshes `.ai-dlc/cache-keepalive.schema.json`. `/ai-dlc:init` runs this skill when the file exists; run it yourself after a plugin upgrade, or when a keep-alive warning names a `null`, missing or legacy value.

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that these settings do not apply there and stop.

`<configure dir>` below is the `cache-keepalive-configure` skill's folder, `${CLAUDE_SKILL_DIR}/../cache-keepalive-configure`, which holds the CLI and documents every key, where each value comes from and workspace trust (its `SKILL.md`). Run the CLI from the repository root.

1. Run `node <configure dir>/templates/cache-keepalive.mjs merge --dry-run`.
   - When it prints `warning: .ai-dlc/cache-keepalive.json does not exist: run /ai-dlc:cache-keepalive-install …`, say that there is no file yet, offer `/ai-dlc:cache-keepalive-install`, and stop: nothing is written.
   - When it stops with exit 1 because the file is not valid JSON or a track (`oneHour`, `fiveMinute`) is not an object, say that the file must be fixed by hand first, and stop.
   - Otherwise show its lines: `+ key: default` for a key it adds, `+ key: null -> default` for a `null` it rewrites, `+ key: 0 -> default` for a legacy `maxPings` of `0` (which no longer means "no limit"), `- key: value` for a key this version no longer has, which it removes, and `update .ai-dlc/cache-keepalive.schema.json` when the schema changed. `up to date` means nothing to do. Every value already set is kept.
2. With consent, run it again without `--dry-run`.
3. When the caller passed values (for `init`, `oneHour.keepWarmFor` and `scope`), apply them as the `cache-keepalive-configure` skill's **change** mode does from step 4: the preview, then the write after consent. A track's `maxPings` follows the keep-warm time written for it.

A merge keeps every value set, so a later change of a default in the plugin does not reach a key already written; `/ai-dlc:cache-keepalive-configure` changes a value.

Done when `node <configure dir>/templates/cache-keepalive.mjs validate` prints no warning for `.ai-dlc/cache-keepalive.json`, or the file did not exist (step 1).
