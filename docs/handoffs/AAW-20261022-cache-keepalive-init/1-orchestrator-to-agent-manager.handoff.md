---
from: orchestrator
to: agent-manager
step: 1
run: AAW-20261022-cache-keepalive-init
---
# Handoff: init creates .ai-dlc/cache-keepalive.json

## Goal
`/ai-dlc:init` (Claude Code only) must create `.ai-dlc/cache-keepalive.json` when it is missing, and merge it on a re-run, the way it handles `.ai-dlc/auto-handoff.json`. This gives a team a committed place for keep-alive settings, for example `fiveMinute.enabled`.

## Facts (verified by research-assistant and the orchestrator, 2026-10-22)
- Keep-alive already reads the file. The settings table is plugins/claude/ai-dlc/hooks/keepalive/settings.ts:45-72, and resolution is at settings.ts:203-247.
  - Precedence: /ai-dlc:keepalive override > settings.local.json env > settings.json env > .ai-dlc/cache-keepalive.json > /config > default.
  - Trust-gated keys are at settings.ts:74-87. In an untrusted folder they are skipped from the repo file.
- No template, schema or init step for this file exists anywhere in the repo.
- Model to follow: plugins/claude/ai-dlc/skills/configure-auto-handoff/ (SKILL.md and templates/auto-handoff.mjs: show/merge/set/validate, plus auto-handoff.schema.json), and the init "Automatic handoff settings" step in plugins/claude/ai-dlc/skills/init/SKILL.md (Phase 0 step 4, Phase 1 bullet, Phase 2, Phase 3).
- Init Phase 1 currently says the keep-alive values are not written by init and go in /config. Reconcile this with the new file. The trust caveat must stay accurate: from the repo file, gated keys apply only where Claude Code trusts the folder.
- Keep-alive's settings are documented in plugins/claude/ai-dlc/hooks/keepalive/README.md.

## Decide and do
- Choose the smallest design that fits: a schema and template under an existing skill, or a sibling skill like configure-auto-handoff. Justify the choice in your report.
- The file init writes should hold every key unset (null), as auto-handoff.json does, so the code defaults apply until the team sets a value. Never write default values that would then outrank /config.
- Update init (all phases), the keep-alive README, and any skill doc that names the file.
- Follow .claude/rules/plugin-development.md:
  - run the build and `--check`;
  - run the tests if a script with tests changes, and add tests in tests/ for any new CLI;
  - run plugin validate (both) if a skill is added;
  - record any change under hooks/keepalive/ in its ATTRIBUTION.md;
  - add a skill that works only in Claude Code to tools/claude-only-skills.json.
- Do not create .ai-dlc/cache-keepalive.json in this repo. Init will do that after review.

## Return
- Line 1: `handoff docs/handoffs/AAW-20261022-cache-keepalive-init/1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`
- Then the changed paths, each marked `code` or `docs`.
- Then the intent, and the checks you ran with their results.

## Amendment (human, 2026-10-22), which supersedes the parts above that conflict with it
1. Init **writes** the two keep-alive values from Phase 1 (the 1h keep-warm time and the default `/ai-dlc:keepalive` scope) into `.ai-dlc/cache-keepalive.json`. Every other key stays unset. Remove "init does not write them; set them in /config" from init. Keep the trust caveat accurate for any trust-gated key written there.
2. Add a command **`/ai-dlc:keepalive-config`** that shows and changes keep-alive's settings in that file (show / set / merge / validate), modelled on configure-auto-handoff. Init points to it where it pointed to /config.
3. Every keep-alive command carries the `ai-dlc:` prefix plus the feature name: `/ai-dlc:keepalive`, `/ai-dlc:keepalive-config`. Docs that tell users to change keep-alive values in `/config` now point to `/ai-dlc:keepalive-config`. The `/config` rows may stay as a per-developer level, but they are no longer the instruction init gives.
4. Human decision (2026-10-22): keep `/ai-dlc:configure-auto-handoff` as it is. Only the keep-alive commands follow the `/ai-dlc:keepalive-*` pattern.

## Amendment 2 (human, 2026-10-22). It supersedes items 2–3 above.
5. **Commands (final):**
   - **`/ai-dlc:cache-keepalive <duration>`** renames `/ai-dlc:keepalive`. It can set the keep-warm time of the 5m track, the 1h track, or both. Choose a clear syntax, for example a track flag, with both tracks as the default; document it.
   - **`/ai-dlc:cache-keepalive-config`** shows and changes the settings in `.ai-dlc/cache-keepalive.json` (show / set / merge / validate). It replaces the planned `/ai-dlc:keepalive-config`.
   - Rename everything that names the old command: the skill folder, the module's `command.run` match, tools/claude-only-skills.json, init, the README, ATTRIBUTION and AGENTS/CLAUDE templates where present, THIRD_PARTY_NOTICES.md, and the tests.
6. **Remove `/config` for keep-alive.** Delete the keep-alive `userConfig` entries from plugins/claude/ai-dlc/.claude-plugin/plugin.json, and remove the `/config` level from settings.ts resolution.
   - New precedence: the cache-keepalive override > settings.local.json env > settings.json env > .ai-dlc/cache-keepalive.json > default.
   - Per-developer values now go in `env` of `.claude/settings.local.json`, which the config command can write, or through the command override.
   - Update the tests, the README, the init Phase 1/3 text (the `/config` rows table goes), and every doc or skill that says `/config` for keep-alive.
   - Leave auto-handoff's own `/config` rows as they are; the request covers keep-alive only.
7. Update the docs and the README fully. Run `plugin test` for the hooks module, and both `plugin validate` runs, since the manifest changes.
8. Human instruction (2026-10-23): do not change `skills/configure-auto-handoff/` in this run. Restore it to HEAD. Copy any shared code into the new skill instead.
9. Human decision (2026-10-23): in the next round, fix only configure-auto-handoff/SKILL.md:13 (point to /ai-dlc:cache-keepalive-config and /ai-dlc:cache-keepalive). The rest of that skill stays untouched.

## Amendment 3 (human, 2026-10-23). It supersedes item 6's "leave auto-handoff's /config rows" and items 8–9's limits on configure-auto-handoff.
10. **Remove `/config` for auto-handoff too**, the same way keep-alive's was removed:
    - Delete auto-handoff's `userConfig` rows from plugin.json and the `/config` level from its settings resolution (hooks/auto-handoff/config.ts and the configure-auto-handoff CLI `show`).
    - The order becomes: settings.local env > settings.json env > process env > .ai-dlc/auto-handoff.json > default.
    - Settings are changed with `/ai-dlc:configure-auto-handoff`; its name stays as it is (earlier decision).
    - Update every doc, skill, test and the init text that names auto-handoff's `/config` rows ("default, unless set in /config" and the rest).
11. **Every auto-handoff command carries the `ai-dlc:` prefix.** Check the module (register.tsx and the rest) for any command or slash name without the prefix, and rename it everywhere.
12. configure-auto-handoff may now change as items 10–11 require. Line 13 is fixed as decided.
13. Also fix the comment at tools/build-copilot.mjs:300 ("ai-dlc's `keepalive`" → cache-keepalive), then rebuild so the plugin-management template copy follows.
