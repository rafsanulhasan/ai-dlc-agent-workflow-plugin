---
run: AAW-20261022-auto-handoff-chain
work-item: none
lifecycle: AAW
step: 2
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 12:00
---

handoff 2-orchestrator-to-agent-manager.handoff.md: passed — every listed artifact exists and matches its description: plan.md (A–F), the research hand-back, the hooks module, plugin.json userConfig, handoff SKILL.md's *The automatic path* and init's percentage step. I checked the research's engine facts myself against the 2.1.306 types: `ClassicResult.sessionTitle` at :1334, `session_title` at :12251 and :15597, `$.command.list` at :3144-3150, `command.run` args at :1817-1828.

All of plan A–F is implemented, including the record's corrections: settings in local env win, init confirms `/rename` at runtime, and the workflow skill is untouched. Nothing is committed. All checks pass (results under Checks).

**What changed**
- **A. The chain goes on while its run is active.** A new guard, `chainGuard` in `register.tsx`, lets the run state decide:
  - A session the person typed into (`unattended` 0) always hands off.
  - If the run this chain claimed becomes done, blocked or abandoned, the chain stops. The log says `run <id> is <status>: chain ends`, a panel stays up, and a typed prompt resumes.
  - If an active run belongs to the chain, there is no cap.
  - Otherwise the old `maxConsecutiveHandoffs` limit applies. The new `chainWhileRunActive: false` setting restores the old behaviour.
  - `unattended` is still counted. The tool gate's `canHandOff` uses the same guard.
  - The seed handler stores `chainRun:<new session>`. `pickRun(runs, branch, session, lineage, claimed)` also accepts a run written by an earlier session of the chain (all ancestors, not just the previous one), or the claimed run while its `session` field is empty. `activeRun` is now `runLookup`.
- **B. The session handoff lists the open records.** A `## Handoff records` section is built in code (`parseStages`, `isOpen`, `pairOf`, `openRecords`, `recordsSection` in `run.ts`). It lists `run.md`, the session handoff, then the records of every Stages row not done or skipped. `last-record` and its pair come first when their stage is open, and files not on disk are marked `(missing)`. The seed line now points the new session at that section.
- **C. Session names.**
  - Format: `<prefix>: <base> (Session N)`.
  - The base name comes from the session's own title, else the transcript's last `custom-title`, else its `ai-title`, else the 8-character id. It is carried in `Lineage.baseName` and any existing wrapper is stripped, so names never nest.
  - The old session gets `/rename` before `/clear`, only when `$.command.list()` includes `rename`. The new session is named through the `sessionTitle` field of its SessionStart answer.
  - A failed or missing rename is logged and never blocks the handoff.
  - **Runtime check for init:** at each startup or resume, the module writes `~/.claude/state/auto-handoff/capabilities.json` (engine version, and whether `rename` is listed). The skill's `rename-check` reads it through the CLI.
- **F. Settings in `.ai-dlc/auto-handoff.json`.** `config.ts` has a `SETTINGS` table of 13 keys, each with an `AI_DLC_AUTO_HANDOFF_*` variable.
  - Each key is read from the first source that sets a valid value: settings.local.json env, then settings.json env (both read from the files, comments allowed), then the process environment, then the repo file, then `/config`, then the default. This is the same order as the workflow loop limits; the record's order did not mention the process environment.
  - Invalid values are logged and the next source applies. Settings reload at each session start.
  - `MIN_HEADROOM` and `DEFAULT_WINDOW` are now the configurable `seedHeadroomTokens` and `defaultContextWindow`. The old `AUTO_HANDOFF_*` names are no longer read; `DISABLE_AUTO_COMPACT` still is.
- **New skill `configure-auto-handoff`.** It is user-only, has the modes show / edit / install / rename-check, and ships a schema plus a CLI, `auto-handoff.mjs` (show, merge, set, validate, capabilities). `merge` adds new keys as `null`, removes keys that no longer exist and keeps every value set.
  - On Copilot, the skill says it does not apply and stops. The build copies every skill and has no exclude list, so I left the build alone.
- **init** now follows that skill's install mode, writes the percentage into the file and reports the rename check. A missing `/rename` never fails init. The `/config` row for the percentage is dropped from the Phase 3 report.
- **Docs.** handoff SKILL.md (Trigger, Which run, Handoff records, Loop guards, Session names, Kill switches, Settings) and the two userConfig descriptions in plugin.json are updated, and the change is recorded in ATTRIBUTION.md.

**Departures from the plan**
1. `AI_DLC_AUTO_HANDOFF_IGNORE_FILES` is one regular expression, not a comma-separated list, because a comma inside a pattern such as `{1,3}` would split it.
2. The new repo file holds every key as `null` rather than its default. A default written into the file would override each developer's `/config`.
3. Boolean and number values written as text ("yes", "70") are accepted in the repo file too, as the module accepts them. `validate` follows the module, not the stricter JSON types in the schema.
4. The skill and CLI are named "Node 18+", but only Node 24 was used here; nothing was run on 18 or on CI's Node 22.

**Open runtime checks** (recorded in ATTRIBUTION.md; unit tests cannot prove these)
- Does Claude Code honour a `sessionTitle` returned by a hooks module?
- Does `rename` exist in this build, and does running it from a hook rename the current session?

The plan's manual end-to-end test has not been run. Its step 1 uses the old `AUTO_HANDOFF_TOKENS`; use `AI_DLC_AUTO_HANDOFF_THRESHOLD_TOKENS` instead.

**Follow-ups outside my scope (`plugins/claude/ai-dlc/` only)**
- Root `README.md` lines 88-95 still document `AUTO_HANDOFF_DISABLE` / `AUTO_HANDOFF_TOKENS`. They are now wrong.
- The repo's `.ai-dlc/catalog.json` does not list the new skill. `/ai-dlc:workflow upgrade` regenerates it.
- The skill-to-agent matrix in docs, if it lists user-only skills.

**Notes**
- `claude plugin test` does not check types. I ran `tsc` (TypeScript 5) against the bundled 2.1.306 engine types: no new errors. The only output is the missing JSX runtime and one existing error in the `session.usage` test mock.
- `.claude/settings.json` was already modified before this run; I did not touch it.

Changed paths:
- plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx — code
- plugins/claude/ai-dlc/hooks/auto-handoff/config.ts — code
- plugins/claude/ai-dlc/hooks/auto-handoff/run.ts — code
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/auto-handoff.test.tsx — code
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/run.test.ts — code
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/config.test.ts (new) — code
- plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs (new) — code
- plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.schema.json (new) — code
- tests/auto-handoff/auto-handoff-cli.test.mjs (new) — code
- plugins/claude/ai-dlc/.claude-plugin/plugin.json (two userConfig descriptions only) — docs
- plugins/claude/ai-dlc/skills/configure-auto-handoff/SKILL.md (new) — docs
- plugins/claude/ai-dlc/skills/handoff/SKILL.md — docs
- plugins/claude/ai-dlc/skills/init/SKILL.md — docs
- plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md — docs
- .claude/agent-memory/ai-dlc-agent-manager/reference_hooks-module-typecheck.md (new) — docs
- .claude/agent-memory/ai-dlc-agent-manager/MEMORY.md — docs
- plugins/copilot/ai-dlc/skills/handoff/SKILL.md — generated
- plugins/copilot/ai-dlc/skills/init/SKILL.md — generated
- plugins/copilot/ai-dlc/skills/configure-auto-handoff/ (SKILL.md, templates/auto-handoff.mjs, templates/auto-handoff.schema.json) — generated

Intent: Make the auto-handoff hooks module keep handing off while the AI-DLC run its chain claimed is active, and stop when that run is done, blocked or abandoned. Each new session gets the open handoff records, each session in the chain is named `[ai-dlc:auto-handoff]: <original> (Session N)` (`/rename` confirmed at runtime for init), and every setting is configurable per repository in `.ai-dlc/auto-handoff.json` through `/ai-dlc:init` and the new `/ai-dlc:configure-auto-handoff`, with settings.local.json env taking precedence.

Checks:
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` → 188 pass, 0 fail, 5 files (baseline before the change: 134). With the chain guard's run check disabled as a temporary mutation, 3 tests failed: the chain, lineage and session-name tests.
- `node --test "tests/**/*.test.mjs"` → 281 pass, 0 fail (13 of them in the new tests/auto-handoff).
- `node tools/build-copilot.mjs` → 5 files updated; `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date.", exit 0.
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` → "✔ Validation passed". The output also lists informational lines for every hook ("gating hook without .catch", including the new classic.UserPromptSubmit) and the existing ICON_MISSING plugin-directory warning.
- `npx @anthropic-ai/claude-code plugin validate --strict .` → "✔ Validation passed".
- `tsc` against the bundled engine types, from a scratch tsconfig in `.scratch/auto-handoff-chain/tc/` → no new errors (details under Notes).
