---
id: 012-engine-migrate-plan
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: ready
stories: [022-migrate-artifacts]
requires_bolts: [002-engine-contract-tooling]
enables_bolts: [011-engine-path-sweep, 014-engine-migrate-settings]
created: 2026-11-14
---

# Bolt 012-engine-migrate-plan

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

§10.2 steps 1 to 3 and 6 and §10.3 (ITEM-118, the plan half): `planMigration` as an ordered list of planners, `applyPlan`, the dry run, the residue rule. It is the first half of the old bolt 012, split by the product-owner (step 1.1.29).

## Stories

- [engine/022 migrate-artifacts](../../stories/022-migrate-artifacts.md)

Wave: W3 (lowest priority of the five, non-blocking; falls back to W5, before 014, if not merged when 009's `requires_bolts` are merged and the spike hand-back is accepted).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §10.2, §10.3 | — |
| lld | system-engineer | low-level design (settles O-9 and O-10 with bolt 014) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-1.5[migrate], AC-1.6[migrate], AC-11.2 to AC-11.9, AC-11.11; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- Three conditions from the software-architect (step 1.1.28 §4) are mandatory here and in the lld: (1) 014 adds, never reorders: the memory and settings planners exist as empty entries and the commit-point order (step 6, artifacts rewritten last) is fixed; (2) the whole dry-run `kind` enum is fixed here (`memory-move`, `memory-merge`, `settings-rewrite`, `advice` included); (3) `requires_bolts: [002]` only.
- Residue (§10.2 step 1) is a non-empty legacy default path of a key whose configured value is already its new path. When `src` equals `dst`, the source is the legacy default instead, as residue: AC-11.7 applied to a mixed block (D42). Without it, ITEM-121's AC-11.10 would fail on this repository's `handoffs`.
- Code that ends at 1.0.0 lives in files of its own where the code base allows; in `workflow.mjs` it sits in the one LEGACY section.
- It does not use any spike finding, so it does not wait for the spike hand-back (C1). **Approved at G3, 2026-11-14 (D79):** the W3 placement on the non-blocking rule, and the assumption that W3 bolts run in parallel; if capacity is serial, W3 grows by about 5 d and this bolt moves to W5 at once.
- It is the only W3 bolt besides 015 allowed to edit `workflow.mjs`, and it rebases onto 004, 005 and 015 (015 merges first, D68). When it merges before bolt 009 starts, 009 absorbs it. If it has not merged when 009's `requires_bolts` are merged and the spike hand-back is accepted, it moves to W5 and runs before 014, rebasing onto 015 and the 009 and 010 renames.
- Its fixtures take every bank and run path from `ARTIFACT_TYPES` and `tests/helpers/paths.mjs`, so the move of bolt 015 does not change them.
- The id `012-engine-migrate-plan` replaces the working name 012a (C3, step 1.1.30.2); `012-engine-migrate` was never created and is retired.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `WF/workflow.mjs` (`planMigration`, `applyPlan`, the dry run, the residue rule; the `migrate` section).
- Creates: `tests/workflow/migrate-{plan,dryrun}.test.mjs`; extends `tests/workflow/helpers/repo.mjs` with git.
- Fixtures: F1 (preview1 repository, all seven artifact types tracked and committed, default `artifacts`: AC-11.2, 11.3, 11.4, 11.8); F2 (custom `artifacts` paths: AC-11.6); F3 (both layouts present, `docs/handoffs/` plus a non-empty `execution-plans/`: AC-11.7); F4 (target exists with different content: AC-11.5, exit 1, `git status` clean, the message names the path); F5 (folder against file: `kind-mismatch`); F6 (no `workflow.json`: legacy defaults, no `workflow.json` written); F12 (an already-migrated repository: "nothing to migrate", exit 0, a second run clean); F13 (a mixed block with `docs/handoffs/` and `execution-plans/` both non-empty).
- Fixture rules, so they run the same on Windows (`core.autocrlf=true`) and Linux (CI): git is isolated (`spawnSync("git", [...])` with an argument list, `GIT_CONFIG_GLOBAL=<os.devNull>`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_TERMINAL_PROMPT=0`; per repository `core.autocrlf=false`, `core.safecrlf=false`, `commit.gpgsign=false`, `user.name`, `user.email`); build under `fs.realpathSync.native(fs.mkdtempSync(...))` and pass `--root`; print repository-relative paths with `/`; each fixture file's body contains its own path (`git log --follow` pairs renames by similarity); build the base repository once in `before()` and `fs.cpSync` it per test; clean up with `fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })`; an identical-file pair is compared byte for byte, and a pair that differs only by CRLF against LF is a conflict, not a drop (the conservative failure). No case-only renames exist in the old-to-new map.
