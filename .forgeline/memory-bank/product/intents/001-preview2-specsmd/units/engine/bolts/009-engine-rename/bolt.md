---
id: 009-engine-rename
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: draft
stories: [018-engine-plugin-identity, 019-engine-prefixes-and-init, 020-keepalive-commands]
requires_bolts: [001-engine-rename-spike, 002-engine-contract-tooling, 003-engine-authorship-rule, 004-engine-events, 005-engine-planning-stages, 006-engine-build-stages, 007-engine-handoff-hook, 008-lens-new-paths, 013-engine-notices]
enables_bolts: [010-lens-rename, 011-engine-path-sweep, 014-engine-migrate-settings]
created: 2026-11-14
---

# Bolt 009-engine-rename

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The engine side of §11: the `engine` plugin in marketplace `forgeline` with `engine:` prefixes (ITEM-126, engine).

## Stories

- [engine/018 engine-plugin-identity](../../stories/018-engine-plugin-identity.md)
- [engine/019 engine-prefixes-and-init](../../stories/019-engine-prefixes-and-init.md)
- [engine/020 keepalive-commands](../../stories/020-keepalive-commands.md)

Wave: W4 (serialised: no other bolt is open; 010 follows it).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §11 | — |
| lld | system-engineer | low-level design (settles O-21 (`stripNamespace`)) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | the test stage quotes `node --test "tests/**/*.test.mjs"`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine`, `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/engine`, `npx @anthropic-ai/claude-code plugin validate --strict .` and `node tools/build-copilot.mjs --check` | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-8.2[name], AC-9.5[rename], AC-16.2[009], AC-16.4[009], AC-16.6 ([text in spec revision r1, change 3.1](../../../../../../specs/001-preview2-specsmd.spec.r1-delta.md); pending human acceptance at G3), AC-17.1[engine], AC-17.2[engine], AC-17.5[engine], AC-17.6, AC-17.7, AC-17.13[keepalive-skill]; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- The spike hand-back must be accepted by the human, with any spec revision applied, before this bolt starts (D40). A spike result can add a spec revision: the schedule keeps a 1.0 d buffer.
- It edits no lens entry. The five lens skills stay under the engine folder until 010; this state is never released.
- The docs stage updates the README, `docs/plugins.md`, the plugin README and, through `agent-manager`, the `CLAUDE.md` dev setup to the engine names (R-9). It does not touch `docs/follow-ups.md` (ITEM-121 moves it).
- AC-16.6 is **pending the human's acceptance at G3**: a `windows-latest` job runs `node --test "tests/**/*.test.mjs"` (about 0.25 d). The bolt quotes the job's first run. Assumption to confirm: the existing suite is green on Windows. If the job shows failures, fixing them is out of scope: the job keeps running `node --test` on the tests present at 009's merge, this bolt's hand-back reports the Windows failures, and `product-owner` decides the follow-up.
- Once merged into the checkout the plugin is loaded from, the local install breaks (`plugins/claude/ai-dlc` disappears) until the human re-registers the marketplace as `forgeline`.
- If bolt 012 merged before this bolt, this bolt absorbs it: it is then the first bolt to edit `workflow.mjs` after 012.
- If spike finding (f) shows that an `"agent"` naming an unknown plugin agent breaks session start, this bolt changes `.claude/settings.json` line 3 as well, and ITEM-121's hand-back records that it was already done.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Moves: `git mv plugins/claude/ai-dlc plugins/claude/engine` (321 tracked files) and `plugins/copilot/ai-dlc plugins/copilot/engine` (270 files, then regenerated) (from 1.1.24; recheck at bolt start). Commit the moves separately from the content edits.
- Edits: 114 plugin files (846 occurrences of `ai-dlc:`) (from 1.1.24; recheck at bolt start), `plugin.json`, both marketplace files (`forgeline`, the `engine` entry; the lens entry stays), `tools/build-copilot.mjs` (`MARKER_NS`, `manifest.name === PLUGIN`, `stripNamespace`), `tools/validate.mjs`, `.github/workflows/validate.yml` (engine paths, and the `windows-latest` job of AC-16.6), `tools/claude-only-skills.json` (`lens-keepalive` to `cache-keepalive-lens`), `E/hooks/keepalive/keepalive.ts` (`COMMAND`, `CONFIGURE`, `STATE`), `E/hooks/*/ATTRIBUTION.md`, `E/hooks/keepalive/MANUAL-CHECKS.md`, `E/skills/init/SKILL.md`, `manage-memory`, `agent-management`, and `tests/helpers/paths.mjs` (the `ENGINE_*` values).
- Agent artifacts naming the old folder, through `agent-manager` (R-14): the `CLAUDE.md` dev setup, `.claude/rules/plugin-development.md` (twin by the harness sync), `.claude/settings.json` line 20 (a permission with path `./plugins/claude/ai-dlc`), and `tools/validate.mjs`. `.claude/settings.json` lines 3 (`"agent"`) and 113 (the marketplace key) stay for ITEM-121's dogfood and its settings rewrite (AC-11.10).
- Existing tests: the literals in the 12 engine-owned files with static imports (from 1.1.24; recheck at bolt start) (`tests/auto-handoff/{auto-handoff-agreement,auto-handoff-cli,cache-keepalive-cli,cli-helpers-drift}.test.mjs` and eight `tests/herdr/*.test.mjs`), plus `validate-script.test.mjs`, `build-copilot-*.test.mjs`, `sync-harness*.test.mjs` and `harness-sync-hook.test.mjs`. They cannot use `paths.mjs` (a static import specifier must be a string literal). New tests written in 002 to 008 and 011 need no edit.
- Creates: `tests/build-copilot-strip-namespace.test.mjs`, `tests/keepalive-names.test.mjs` (each constant equals its skill's namespaced name), `tests/state-namespace.test.mjs` (engine half; the lens half is written in 010).
- Must not touch: any `L/` file, the lens marketplace entry, `LENS_PLUGIN` and `LENS_DIR`, the five lens skills.
- Spike-sensitive values, one home each: the memory folder name (a) in `memoryFolderOf(pluginName, agentId)` (bolt 014); the marketplace and plugin ids in settings (b) in the `SETTINGS_RULES` table (bolt 014); the plugin names in the manifests, with `paths.mjs` holding the folder names (a test asserts the constants equal the manifests); the `$.state` plugin namespace (e) in the engine `STATE` of `keepalive.ts`; the command prefixes (g) in `COMMAND` and `CONFIGURE` (each equals its skill folder name); finding (f) fixes no code, only the order of the `migrate` skill and the conditional change to settings line 3.
