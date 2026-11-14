---
id: 013-engine-notices
unit: engine
intent: 001-preview2-specsmd
type: simple-bolt
status: ready
stories: [025-specsmd-attribution]
requires_bolts: [002-engine-contract-tooling]
enables_bolts: [009-engine-rename]
created: 2026-11-14
---

# Bolt 013-engine-notices

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

§13: specsmd attribution in both plugin builds (ITEM-119, P1 licence compliance).

## Stories

- [engine/025 specsmd-attribution](../../stories/025-specsmd-attribution.md)

Wave: W2 (merges first of its wave).

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

AC-12.1, AC-12.2, AC-12.3 (for the files adapted so far); plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- The build test uses the current plugin path through `ENGINE_DIR` (R-7).
- Later adapting bolts (005, 006, 014) append to `ATTRIBUTION.md`, and ITEM-122 compares the full list.
- It merges before bolt 005 in W2 (merge order 013, 004, 005).
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `tools/build-copilot.mjs` (`ROOT_NOTICES`, about 12 lines), `THIRD_PARTY_NOTICES.md`.
- Creates: `E/NOTICE.md` (if the lens-style notice is wanted), `E/ATTRIBUTION.md` (header and format; 005 appends), `tests/build-copilot-notices.test.mjs` (modelled on `build-copilot-license.test.mjs`, rooted at `ENGINE_DIR`).
- Must not touch: anything else in `tools/`.
