---
from: orchestrator
to: agent-manager
step: 1
run: AAW-20261023-keepalive-explicit-defaults
---
# Handoff: write every keep-alive default explicitly
## Goal
`.ai-dlc/cache-keepalive.json`, as written by `/ai-dlc:init` (the cache-keepalive-config **install** mode, CLI `merge`), holds every one of the 26 keys with its current default value instead of `null`. The values init asks for (`oneHour.keepWarmFor`, `scope`) are then applied on top.
## Rules
- Single source: take the defaults from the SETTINGS table (hooks/keepalive/settings.ts), the same way the CLI already checks against it. Don't hard-code a second list. If the CLI can't import the .ts table, generate them from the schema's defaults and keep the existing schema-versus-SETTINGS test guarding them.
- `merge` on an existing file: keep every value already set; fill keys that are missing **or null** with their default; remove keys this version no longer has. `--dry-run` shows each fill.
- Trust gate: 16 of the keys are trust-gated. With them all now written in the repo file, an untrusted folder must not log a warning for a skipped key whose file value equals its default (nothing changes). Warn only when a skipped value differs from the default. Make the module (settings.ts / keepalive.ts) and the CLI `show` agree, and test both.
- `null` stays valid in the file and still means "use the default", for hand edits.
- Docs: init (Phase 1/2/3 text that says other keys stay unset), cache-keepalive-config SKILL.md, the keep-alive README, and ATTRIBUTION. State the trade-off in one sentence: the written defaults are this plugin version's; a later plugin default change does not reach a key already written (`merge` keeps set values), so delete a key or set it to null to follow the plugin default.
- Auto-handoff's `.ai-dlc/auto-handoff.json` is NOT in scope (keeps null).
- Then re-run install on this repo's `.ai-dlc/cache-keepalive.json` (merge, then set oneHour.keepWarmFor=8h scope=session), so the committed file shows explicit defaults. Note: the human hand-set `enabled: true` and `oneHour.enabled: true` there; keep them.
## Checks
Build and --check; node --test "tests/**/*.test.mjs"; plugin test; both plugin validate; workflow validate. Don't commit.
## Return
Line 1 `handoff <this file>: passed|failed — <why>`; changed paths marked code/docs; the intent; the checks with their real results.

## Amendment (human, 2026-10-23). It supersedes "`null` stays valid" and the trade-off wording above.
- In `cache-keepalive.schema.json`, mark all 26 properties **non-nullable**: no `null` in any `type`, and every key `required`, so the file always holds a concrete value.
- CLI: `validate` rejects `null` or a missing key; `set k=null` is refused with a clear message; `merge` still fills missing (and legacy null) keys with the default, so an old file can be repaired.
- Module: a `null` left in the file by hand is treated as an invalid value (one warning, the next level or the default applies). Don't crash.
- Docs: drop "set it to null to follow the plugin default". Say instead that every key holds an explicit value, written from this plugin version's defaults, and a later default change does not reach a key already written; change the value with `/ai-dlc:cache-keepalive-config set`.
- Update the tests to match.
- (human, 2026-10-23) Both `/ai-dlc:init` and `/ai-dlc:cache-keepalive-config` replace `null` values with the defaults: every write path (install/`merge` and `set`) rewrites any `null` key to its default, as well as any missing key, and says so in its output; `validate` reports each `null` key and names the fix; the skill's **show** mode, when it finds a `null`, offers to run install to repair the file.
- (human, 2026-10-23) `validate` checks both sources: the JSON file (schema, non-null, required keys) **and** every `AI_DLC_KEEPALIVE_*` variable in the `env` of `.claude/settings.local.json` and `.claude/settings.json`. For each variable: an unknown name, or a value that fails the key's kind or limits, is reported with the file, variable and reason; exit non-zero on any error. Use the same value rules as the module (one shared check, not a copy). Note a gated key in settings.json env that an untrusted folder would skip, as a warning, not an error.
