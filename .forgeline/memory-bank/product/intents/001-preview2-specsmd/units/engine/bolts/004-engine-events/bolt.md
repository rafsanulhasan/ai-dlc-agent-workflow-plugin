---
id: 004-engine-events
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: ready
stories: [010-execution-plans-home, 011-typed-event-records]
requires_bolts: [002-engine-contract-tooling]
enables_bolts: [007-engine-handoff-hook, 008-lens-new-paths, 009-engine-rename, 015-engine-forgeline-root]
created: 2026-11-14
---

# Bolt 004-engine-events

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

`execution-plans/` with the execution plan, and records as typed events checked by `validate`, with no runtime (§7, §8, ITEM-115).

## Stories

- [engine/010 execution-plans-home](../../stories/010-execution-plans-home.md)
- [engine/011 typed-event-records](../../stories/011-typed-event-records.md)

Wave: W2 (merge order 013, 004, 005).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §7, §8 | — |
| lld | system-engineer | low-level design (G-REC replaces four regexes; the accept list is generated from real record names) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-5.2 to AC-5.5, AC-6.1 to AC-6.4, AC-6.5[contract], AC-6.6; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It merges before bolt 005 (R-6). W2 merge order: 013, 004, 005.
- It owns `orchestrator.md`, `agent-invocation`, the `handoff` skill and the `AGENTS.md` template source during W2.
- Hot-file hunk split: `workflow.mjs` sections 4 and 7 are 004's; 005 owns the planning-stage check (section 8). `E/skills/ai-dlc/SKILL.md`: 004 owns the Step 3 handoff bullet, 005 owns the table rows and the PDLC, ASDLC and STBLC section.
- Reader pages (R-9): README and `docs/plugins.md` describe `docs/handoffs/` as the run folder today. This bolt's docs stage updates that run-folder text; bolts 005 and 013 send *Docs update* requests to it.
- The accept list of `record-names.mjs` is generated from the record names in `docs/handoffs/**` and `execution-plans/**`, not typed by hand, because today's four regexes disagree. The human's acceptance of the spike hand-back (bolt 001) is copied in as one valid `verdict` vector.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `WF/workflow.mjs` (about +230: G-REC, `EVENT_RULES`, `events`, the opt-in scan), `E/skills/handoff/SKILL.md`, `E/skills/agent-invocation/SKILL.md`, `E/agents/orchestrator.md`, `tools/templates/AGENTS.template.md`, `E/skills/init/SKILL.md` (install `event.schema.json`), `E/skills/workflow/SKILL.md`, `E/skills/ai-dlc/SKILL.md` (the "Every handoff is an artifact" bullet in Step 3 only), the legacy paths in those files (S-7), and the `docs/handoffs/` literals in `tests/herdr/` (14 hits in 8 files; C-7).
- Creates: `WF/event.schema.json`; `tests/fixtures/grammar/record-names.mjs` (canonical); `tests/workflow/{record-names,events}.test.mjs`.
- Deletes: `.handoff/config.md` (nothing references it; AC-5.5 already holds).
- `E/skills/herdr/` holds no legacy path (no edit). The `tests/herdr` change is literal-only and the existing herdr tests are its regression check; bolt 009 later edits six of the same files, sequentially.
