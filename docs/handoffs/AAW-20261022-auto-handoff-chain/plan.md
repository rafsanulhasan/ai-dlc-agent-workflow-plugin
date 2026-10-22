# Plan: auto-handoff keeps chaining, carries the handoff records, names sessions

## Context

The auto-handoff hooks module (`plugins/claude/ai-dlc/hooks/auto-handoff/`) stops a chain after two handoffs. The cause is the `unattended` counter (`register.tsx:41`, checked at `:352-361`). Only a prompt you type resets it (`:656-663`). The seed prompt the module sends has origin `plugin`, so it doesn't reset it. With `maxConsecutiveHandoffs` at its default of 2, the third session never hands off. Tests at `tests/auto-handoff.test.tsx:675-687` and `:762-770` assert this as intended. Nothing stops the chain when the run finishes: `run.md` `status` is only used to pick a run (`run.ts:115-120`).

The seed and the session handoff point at `run.md` and the scratch `session-*.md`. They don't list the run's `*.handoff.md` / `*.handback.md` records; `last-record` is used only to work out the step code (`run.ts:174-194`).

Nothing names sessions today.

What you asked for:
1. Keep handing off for as long as the run is **active**. Stop when `run.md` says `done`, `blocked` or `abandoned`. With no active run, keep today's 2-handoff guard.
2. The new session gets the files the `handoff` skill wrote, **only for work that isn't done**: `run.md`, the session handoff note, and the handoff record / hand-back of every stage in `run.md`'s *Stages* table whose status isn't `done` or `skipped`. That includes `last-record` and its pair when that stage is still open.
4. Every setting the module uses can be configured in the target repo's `.ai-dlc/auto-handoff.json`, through `/ai-dlc:init` and a new `/ai-dlc:configure-auto-handoff` command. Precedence: `auto-handoff.json` > `.claude/settings.json` `env` > `.claude/settings.local.json` `env`. Env keys start with `AI_DLC_`.
3. Session names: the original session is renamed `[ai-dlc:auto-handoff]: <original name> (Session 1)`. Each seeded session is `[ai-dlc:auto-handoff]: <original name> (Session N)`. The original name is carried along the chain and the prefix is never nested.

## Routing

This is a hooks module plus a skill document, so it goes through the agent-artifact lifecycle (`AAW`). Run folder: `docs/handoffs/AAW-20261022-auto-handoff-chain/`. It gets `run.md` and handoff records as usual.

| Step | Agent | Work |
|---|---|---|
| 0 | research-assistant (Jon Skeet) | Confirm how a hooks module can rename the current session. Can `$.command.run({ command: 'rename', args })` run the built-in `/rename`, or is there an engine API for setting the title? Sources: Claude Code docs, the mod API types (`claude-code` package `EngineInterface`), the `plugin-authoring` skill. **The rename item depends on this.** If renaming isn't possible, I'll come back to you before step 1. |
| 1 | agent-manager (Boris Cherny) | Make the change below. Hand back the changed paths marked code/docs. |
| 2.1 / 2.2 | brutal-critique (docs) · sqa-engineer (code tests) | Parallel review by kind. |
| 3.1 / 3.2 | code-reviewer ×2 (standards, spec axes) | Review the code and tests. |
| loop | agent-manager | Fix rounds use the limits from `node .ai-dlc/workflow.mjs rounds --json` (2 rounds / 1 failure unless set otherwise). |

## The change (agent-manager's brief)

**A. Chain until the run is finished** (`register.tsx`, `config.ts`, `run.ts`)
- In `tryHandoff`, before the `unattended` check, look up the active run (`activeRun`, `register.tsx:210-235`). When this session has an `active` run on the current branch, skip the `unattended` guard. Still count `unattended`, so the panel and log stay right.
- If the picked run's status is `done`, `blocked` or `abandoned`, don't hand off. Fall back to normal behaviour and log `run <id> is <status>: chain ends`. `pickRun` already filters to `active`, so add an explicit check that reads the status of the run this session claimed.
- **Fix `pickRun` for chained sessions.** It matches `run.md` `session` to the current id. In a seeded session that is still the previous session's id unless the orchestrator has already rewritten it. Have the seed handler (`register.tsx:665-717`) record the run id in a `chainRun:<newSession>` store key. Then let `pickRun` also accept a run whose `session` is in this session's lineage (`from`). Otherwise the third handoff falls back to the plain brief.
- Keep the 40k headroom, the kill switches and the `fired:` marker as they are.

**B. Carry the handoff records** (`run.ts` `assembleSessionHandoff`, the seed text at `register.tsx:703-708`)
- Add a `## Handoff records` section that code builds, not Haiku. Parse `run.md`'s *Stages* table (Step, Status, Handoff, Handback columns). List the handoff and hand-back paths of every row whose status is `pending`, `in-progress` or `blocked`, plus `run.md` and the session handoff note. `done` and `skipped` stages are left out. Paths are checked to exist, and a missing one is marked `(missing)`.
- `last-record` and its pair (same step code, agents swapped) are listed first when their stage is still open.
- The seed line names `run.md` and the open records' section, besides the session handoff note.

**C. Session names** (subject to step 0)
- In `handoff()`, before `/clear`, read the old session's name from its transcript: the last `custom-title` line, else `ai-title`, else the first 8 characters of the id. Strip an existing `[ai-dlc:auto-handoff]: … (Session N)` wrapper to get the base name.
- Store `baseName` in the `Lineage` record (`register.tsx:48`, `:237-244`) so it travels down the chain.
- Rename the old session `[ai-dlc:auto-handoff]: <base> (Session <depth>)` (Session 1 on the first handoff) just before `/clear`. In the seed handler, rename the new session to `(Session <depth>)`. `lineage.depth` already counts this.
- A failed rename is logged and never blocks the handoff.

**F. Repository configuration: `.ai-dlc/auto-handoff.json`** (`config.ts`, new skill, `init`)
- **Settings**, every one configurable:

  | JSON key | Env key | Default |
  |---|---|---|
  | `enabled` | `AI_DLC_AUTO_HANDOFF_ENABLED` | `true` (replaces `AUTO_HANDOFF_DISABLE`) |
  | `thresholdPercent` | `AI_DLC_AUTO_HANDOFF_THRESHOLD_PERCENT` | 80 |
  | `thresholdTokens` | `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS` | unset (replaces `AUTO_HANDOFF_TOKENS`) |
  | `defaultContextWindow` | `AI_DLC_AUTO_HANDOFF_DEFAULT_CONTEXT_WINDOW` | 500000 |
  | `seedHeadroomTokens` | `AI_DLC_AUTO_HANDOFF_SEED_HEADROOM_TOKENS` | 40000 |
  | `maxConsecutiveHandoffs` | `AI_DLC_AUTO_HANDOFF_MAX_CONSECUTIVE` | 2 (only without an active run) |
  | `chainWhileRunActive` | `AI_DLC_AUTO_HANDOFF_CHAIN_WHILE_RUN_ACTIVE` | `true` |
  | `renameSessions` | `AI_DLC_AUTO_HANDOFF_RENAME_SESSIONS` | `true` |
  | `sessionNamePrefix` | `AI_DLC_AUTO_HANDOFF_SESSION_NAME_PREFIX` | `[ai-dlc:auto-handoff]` |
  | `briefTemplate`, `instructionsTemplate` | `AI_DLC_AUTO_HANDOFF_BRIEF_TEMPLATE`, `…_INSTRUCTIONS_TEMPLATE` | current defaults |
  | `ignoreFiles` | `AI_DLC_AUTO_HANDOFF_IGNORE_FILES` (comma-separated) | current default |
  | `viewer` | `AI_DLC_AUTO_HANDOFF_VIEWER` | current default |

  `DISABLE_AUTO_COMPACT` is Claude Code's own variable, so it is still honoured as is.
- **Resolution, per key:**
  1. `.ai-dlc/auto-handoff.json`
  2. the `env` block of `.claude/settings.json`
  3. the `env` block of `.claude/settings.local.json`
  4. the plugin's `/config` userConfig (kept as a per-user fallback)
  5. the built-in default

  Steps 2–3 read the files directly with `$.fs.read`, because the merged process environment can't tell them apart. The old `AUTO_HANDOFF_*` names are dropped: 1.0.0 is unreleased.
- **Validation.** Invalid values are logged and fall through to the next source. The config is reloaded at each session start, so a chain picks up edits.
- **Schema.** Ship `templates/auto-handoff.schema.json` and point to it with `$schema` from the file.
- **New skill `configure-auto-handoff`** (`/ai-dlc:configure-auto-handoff`):
  - Shows the effective value and source of each key.
  - Edits values from plain words.
  - Writes `.ai-dlc/auto-handoff.json`. If the file exists, it adds the keys that are new, removes the keys that no longer exist, and keeps every value already set.
  - Claude-only: agent-manager checks how the build keeps a skill out of the Copilot plugin, or makes the skill say it doesn't apply on Copilot.
- **`init`.** The step that asks for the threshold percentage now follows `configure-auto-handoff` (by reading its `SKILL.md`, per the plugin rule) and writes the file. `/ai-dlc:workflow upgrade`, or init on re-run, does the same add/remove merge.

**D. Docs and attribution**
- `skills/handoff/SKILL.md`, *The automatic path*:
  - Update **Loop guards**: the guard applies only without an active run; an active run chains until its status changes.
  - Describe the handoff records section.
  - Add a **Session names** bullet.
- `plugin.json` `maxConsecutiveHandoffs` description: "Handoffs allowed before you type a prompt, when no AI-DLC run is active".
- Record the change in `hooks/auto-handoff/ATTRIBUTION.md`.
- Run `node tools/build-copilot.mjs`. The Copilot plugin gets only the SKILL.md change.

**E. Tests** (`hooks/auto-handoff/tests/`)
- Update the guard tests at `auto-handoff.test.tsx:675-687` and `:762-770`: without a run they still stop at 2; with an active run they chain 4 or more times.
- New tests:
  - The chain stops when `run.md` becomes `done` or `blocked`.
  - `pickRun` follows the lineage across 3 or more sessions.
  - The records section lists `last-record` and its pair.
  - Rename calls carry the right names for Sessions 1, 2 and 3, with no nesting.
  - The records section lists only stages that aren't done.
  - Config precedence: the JSON beats `settings.json` env, which beats `settings.local.json` env, which beats userConfig, which beats the default. An invalid value falls through.
- Repository tests (`tests/`) cover the merge: keys added and removed, values kept.
  - A failed rename doesn't block the handoff.
- The mock at `:159-163` treats every `command.run` as `/clear`. Make it branch on `command`.

## Verification

- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` (the hooks module tests)
- `node --test "tests/**/*.test.mjs"`
- `node tools/build-copilot.mjs --check`
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` and `… validate --strict .`
- Manual end to end:
  1. Start an interactive session with `AUTO_HANDOFF_TOKENS` set low (e.g. 60000) on a branch with an active test `run.md`.
  2. Confirm three or more chained sessions named `… (Session 1/2/3)`.
  3. Confirm each seed names `run.md` and `last-record`.
  4. Run `/ai-dlc:configure-auto-handoff`. Set `thresholdTokens` in the JSON and a different value in `settings.json` env, and confirm the JSON wins.
  5. Set the run to `done` and confirm the chain stops. Check `~/.claude/state/auto-handoff/auto-handoff.log`.
