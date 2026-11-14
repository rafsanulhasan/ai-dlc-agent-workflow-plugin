---
id: 014-engine-migrate-settings
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: ready
stories: [023-migrate-memory-and-settings, 024-migrate-skill-and-detect, 031-migrate-config-moves]
requires_bolts: [001-engine-rename-spike, 012-engine-migrate-plan, 009-engine-rename, 010-lens-rename, 015-engine-forgeline-root]
enables_bolts: [011-engine-path-sweep]
created: 2026-11-14
---

# Bolt 014-engine-migrate-settings

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

§10.2 steps 4 and 5 and §10.4 (ITEM-118, the settings half; ITEM-126, AC-17.10 and AC-17.12): memory folders and the `MEMORY.md` union, the settings rewrite, the `/engine:migrate` skill, the `validate` detect-and-warn, the `upgrade` split and the remaining `merge` guards. It is the second half of the old bolt 012; it fills the planners bolt 012 left empty and never reorders them. It also carries story engine/031: the `/engine:migrate` move of the `.ai-dlc/*` config files per `CONFIG_PATHS` (ITEM-127 AC-9; D72).

## Stories

- [engine/023 migrate-memory-and-settings](../../stories/023-migrate-memory-and-settings.md)
- [engine/024 migrate-skill-and-detect](../../stories/024-migrate-skill-and-detect.md)
- [engine/031 migrate-config-moves](../../stories/031-migrate-config-moves.md): the `.ai-dlc/*` config moves per `CONFIG_PATHS` (bolt 015; the sub-layout of D70), a new planner beside 012's.

Wave: W5 (alone, preceded by 012-engine-migrate-plan when that fell back from W3).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §10.2 steps 4 and 5, §10.4 | — |
| lld | system-engineer | low-level design (settles O-9 and O-10 with bolt 012) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-11.1[skill], AC-15.8[detect], AC-16.2[014], AC-17.10, AC-17.12, AC-18.10[config files] (the `.ai-dlc/*` moves that ITEM-121 runs on this repository), AC-18.9 (ITEM-127 AC-9; engine/031; G1 amendment D69, approved at G3, 2026-11-14 (D80)); plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It requires the spike hand-back accepted by the human (D40), bolt 012, bolt 015 (the `CONFIG_PATHS` table) and the renames of 009 and 010. "The migration bolt" of AC-17.14 is this bolt (C1).
- The skill follows the flow of §10.4, and the guide part of AC-11.1 belongs to ITEM-123. Reader pages (R-9): its docs stage updates the migrate entry.
- The `artifacts` merge guard is already delivered by bolt 002; this bolt delivers the rest.
- Story engine/031 (the `.ai-dlc/*` moves) stays here and not in bolt 015 (D72), so 012 stays non-blocking: 015 does not need `planMigration` to exist, and 012's artifacts planner picks up the new bank root by itself because it reads `ARTIFACT_TYPES`.
- ITEM-121 runs this migration on this repository next.
- The id `014-engine-migrate-settings` replaces the working name 012b (C3, step 1.1.30.2).
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `WF/workflow.mjs` (`memoryFolderOf`, `legacyMemoryFolderOf`, the settings rewrite, the `MEMORY.md` union, detect-and-warn, the `upgrade` split, the remaining `merge` guards), `E/skills/workflow/SKILL.md` (the upgrade split), `E/skills/init/SKILL.md` (a pointer), the root `E/ATTRIBUTION.md` if it adapts specsmd.
- Config moves (engine/031): a planner entry beside 012's that moves `.ai-dlc/*` per `CONFIG_PATHS` (D39 drop rule, ADR-0013 order, `--dry-run` lists the moves), with a fixture of config files at the old paths (numbered in the lld) and `tests/workflow/migrate-config.test.mjs`.
- Creates: `E/skills/migrate/SKILL.md` (shipped to Copilot, so not listed in `claude-only-skills.json`); `tests/workflow/migrate-{memory,settings,detect}.test.mjs`.
- Fixtures: F7 (memory folders `ai-dlc-<id>/` including a project-local and a non-plugin `ai-dlc-*` folder, one pair of identical files, one pair with differing `MEMORY.md`: AC-17.10 (a) to (e)); F8 (`.claude/settings.json` and `settings.local.json` as JSONC with comments, one LF and one CRLF with BOM: the rewrite keeps comments, line endings and BOM, and the text parses after); F9 (a key for another marketplace, `ai-dlc@<other>`, and an `ai-dlc:<id>` in the same file: `advice:` lines only, prefix rules skipped for that file); F10 (a `repo` value ending `…/ai-dlc-agent-workflow-plugin` stays untouched); F11 (a settings file that does not parse before the rewrite is left untouched and reported, never half-written). The fixture rules of bolt 012 apply.
- Rewrite method (confirmed in the lld): one scanner over the JSONC text finds string-token spans, whole-string and prefix rules apply to a token's content, replacements are applied from the end, and the result is checked with the existing `stripComments` plus `JSON.parse`.
- Spike-sensitive values, one home each: the memory folder name (a) in `memoryFolderOf(pluginName, agentId)`, with the old form only in `legacyMemoryFolderOf` (the one place `ai-dlc-` is built; the sweep allowlists it); the marketplace and plugin ids in settings (b) in the `SETTINGS_RULES` table (whole-string rules, prefix rules, the lens command map, `NEW_MARKETPLACE`), never inline regexes, with one table-driven test case per rule; finding (f) fixes only the order of the skill (settings rewritten before the agent is used).
