---
id: 011-engine-path-sweep
unit: engine
intent: 001-preview2-specsmd
type: simple-bolt
status: draft
stories: [021-stale-names-check]
requires_bolts: [009-engine-rename, 010-lens-rename, 012-engine-migrate-plan, 014-engine-migrate-settings]
enables_bolts: []
created: 2026-11-14
---

# Bolt 011-engine-path-sweep

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The §15 stale-names check with its allowlist, and the fixes in engine-owned paths (ITEM-117; ITEM-126, AC-17.3 and AC-17.4).

## Stories

- [engine/021 stale-names-check](../../stories/021-stale-names-check.md)

Wave: W6 (after ITEM-121; ITEM-122, ITEM-123 and ITEM-124 follow).

## Stages

AAWP simple-bolt: change → test → code-review; `docs` and `critique` run after `change`. `intent`, `design` and `lld` are skipped.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-10.1 to AC-10.4, AC-16.4[011], AC-17.3, AC-17.4; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It starts after ITEM-121 (the dogfood migration) has moved the `docs/` history out of the search scope (R-1). That is why it requires 012 and 014: ITEM-121 runs their migration. ITEM-121 is a work item, not a bolt, so `requires_bolts` cannot list it; the ordering is stated here and in the task plan.
- The allowlist names the migration files, and the reader rename pages that ITEM-123 writes later. The test must accept an allowlist path that does not exist yet.
- `docs/follow-ups.md` is out of scope: ITEM-121 moves it to `memory-bank/project/follow-ups.md` with `git mv`, and `documentation-writer` updates its stale paths in the same stage (R-8).
- Fix volume is unknown until it runs: the estimate is a range (1 to 3.5 d).
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Creates: `tests/stale-names.test.mjs`, `tools/stale-names.allowlist.json`. The test file accepts allowlist paths that do not exist yet, and its own regex strings are allowlisted.
- Edits: the leftover list after S-7, expected to be small (about 15 files or fewer): whatever the sweep finds in engine-owned paths. A hit in a lens-owned path returns to bolt 010 as a fix round.
- Expected allowlist entries (decided when the bolt runs): migration code and fixtures, `tests/fixtures/grammar/**`, the hook and lens fallback tests, the files that end at 1.0.0 (`runs-root.ts`, `engine-names.ts`), the `validate` detect code, the rename pages.
