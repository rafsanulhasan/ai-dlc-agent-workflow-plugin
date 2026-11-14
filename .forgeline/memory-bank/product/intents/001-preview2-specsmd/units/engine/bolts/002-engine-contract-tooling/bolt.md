---
id: 002-engine-contract-tooling
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: draft
stories: [002-artifact-types-table, 003-init-scaffolding, 004-cli-legacy-fallback, 005-front-matter-grammar, 006-bolt-types-contract]
requires_bolts: []
enables_bolts: [004-engine-events, 005-engine-planning-stages, 007-engine-handoff-hook, 008-lens-new-paths, 009-engine-rename, 012-engine-migrate-plan, 013-engine-notices]
created: 2026-11-14
---

# Bolt 002-engine-contract-tooling

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The `workflow.mjs` contract core that every later bolt builds on (ITEM-112):
- `workflow.mjs` made importable (`IS_MAIN`, exports);
- `ARTIFACT_TYPES` and the schema;
- G-FM;
- `boltTypes` (`construction-bolt` and `simple-bolt`), the skip rule and the `building` flag;
- the resolver with the per-key rule and the fallback warning, with their vectors;
- the `artifacts` merge guard;
- `init` scaffolding.

## Stories

- [engine/002 artifact-types-table](../../stories/002-artifact-types-table.md)
- [engine/003 init-scaffolding](../../stories/003-init-scaffolding.md)
- [engine/004 cli-legacy-fallback](../../stories/004-cli-legacy-fallback.md)
- [engine/005 front-matter-grammar](../../stories/005-front-matter-grammar.md)
- [engine/006 bolt-types-contract](../../stories/006-bolt-types-contract.md)

Wave: W1 (in parallel with 001 and 003; merges before 003).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §2 to §4, §6.1 to §6.2, §9 | — |
| lld | system-engineer | low-level design (O-12 is closed; the no-`lib/` decision is final here) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-1.1, AC-1.2, AC-1.3, AC-1.4, AC-1.5[contract], AC-1.6[map], AC-2.1[validate], AC-2.2[validate], AC-2.3[list], AC-4.1[construction, simple], AC-4.4[validate], AC-5.1, AC-8.1, AC-8.2[scaffold], AC-8.4, AC-8.5, AC-15.1 to AC-15.8[cli]; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- `spike-bolt` is not in the template yet; it lands in bolt 005 with `probe` (R-4).
- The prose that defines the building stage belongs to bolt 003 (R-5); this bolt keeps only the flag and its validation. This bolt merges before 003.
- `workflow.mjs` stays one file through preview2 (forecast about 2,100 to 2,300 lines); a `lib/` split is revisited at ITEM-125 or above 2,500 lines. The decision is final in this bolt's lld.
- `tests/helpers/paths.mjs` is created with today's values and is for new tests only: the 16 existing test files that import plugin code through static specifiers keep their literals, which bolts 009 and 010 edit (C-1).
- New tests go in new files per concern, never in `workflow.test.mjs`, to limit merge conflicts in W2 and W3 (only this bolt edits `workflow.test.mjs`).
- The drift test finds every `plugins/claude/*/**/tests/fixtures/grammar/*.mjs` and asserts that each byte-equals (LF-normalised) a canonical file in `tests/fixtures/grammar/`; bolts 007 and 008 never edit it.
- The `artifacts` merge guard protects this repository's mixed block (D42: `handoffs` new, six keys legacy) from a `merge` or `upgrade` that would add `intents` and flip the layout.
- Every `workflow.mjs` run on this repository prints the true `ignored docs/handoffs` warning until ITEM-121 (D42, the per-key rule). That is expected.
- Hot files and their owner sequence: `WF/workflow.mjs` 002 → 004 and 005 (W2) → 009 → 012 and 014; `WF/workflow.json` 002 → 005; `WF/workflow.schema.json` 002 only; `E/skills/init/SKILL.md` 002 → 004 → 009 → 014; `E/skills/workflow/SKILL.md` 002 → 004 → 009 → 014.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `WF/workflow.mjs` (about +520 net, inside the sections of the order below that it owns), `WF/workflow.schema.json` (about +90), `WF/workflow.json` (the `artifacts` block to 13 keys, `boltTypes` with two types, five `building: true` flags), `E/skills/init/SKILL.md` (scaffolding of `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` with `.gitkeep`, the preview2 `artifacts` block), `E/skills/workflow/SKILL.md` (`artifacts` command, `boltTypes`).
- Creates: `tests/helpers/paths.mjs` (new tests only); `tests/workflow/helpers/repo.mjs` (temp-tree writer, no git yet); `tests/fixtures/grammar/{front-matter,runs-root,fallback-warning}.mjs`; `tests/grammar-vectors-drift.test.mjs`.
- Existing tests it must update: `tests/workflow/handoff-naming.test.mjs` (asserts `docs/handoffs/...` as the default) and the default-workflow and `artifacts` assertions in `tests/workflow/workflow.test.mjs`.
- New tests (runner `node --test`): `tests/workflow/artifacts.test.mjs` (AC-1.2 to 1.5, 5.1, 8.1, 8.5, `artifacts --json`), `front-matter.test.mjs`, `runs-root.test.mjs` (resolver and formatter vectors, one stderr line, fallback marker), `bolt-types.test.mjs` (AC-4.1, 4.4, skip rule), `bolt-type-ids.test.mjs` (the AC-2.3 grep, rooted at `ENGINE_DIR`), `merge-guard.test.mjs`.
- Must not touch: the `docs-rules` templates, `.claude/rules/`, the `review` skill, `orchestrator.md` (bolt 003's).
- `init` is a skill, so no node test can run it: the test checks that `init/SKILL.md` lists the three folders and the template's `artifacts` block validates. The end-to-end walk is ITEM-122's (AC-14.7).
- `workflow.mjs` section order (banner comments; a bolt adds code only inside its sections): 0 header, options, `IS_MAIN` (002; help lines added by 002, 004, 014); 1 catalog (existing); 2 constants, `TOP`, `STAGE_KEYS` with `building` (002); 3 artifacts contract (002); 4 grammars: `parseFrontMatter` (002), `parseRecordName` and `RECORD_TYPES` (004); 5 LEGACY (`// fallback: remove in 1.0.0`): `resolveRunsRoot`, `formatFallbackWarning`, the exit handler (002), detect-and-warn (014); 6 `boltTypes` (002); 7 events (004); 8 planning-stage check (005); 9 `validate` = existing body + `SECTION_CHECKS` and `REPO_CHECKS` arrays, one name per line (each bolt adds one line; the later merger rebases); 10 show, rounds, diff, merge with its guards (the `artifacts` guard in 002, the rest in 014); 11 migrate (012, 014); 12 main dispatch.
- The layout rule is `isStr(artifacts.intents) ? "preview2" : "legacy"`, used by `validate`, `resolveRunsRoot`, `migrate` and the merge guard from one function, `layoutOf`.
