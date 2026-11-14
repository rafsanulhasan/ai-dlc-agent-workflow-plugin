---
id: 005-engine-planning-stages
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: draft
stories: [012-planning-stages, 013-bank-templates, 014-spike-bolt-type]
requires_bolts: [002-engine-contract-tooling]
enables_bolts: [006-engine-build-stages, 009-engine-rename]
created: 2026-11-14
---

# Bolt 005-engine-planning-stages

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The planning side of bolts (ITEM-114 part a):
- the `unit-design`, `bolt-design` and `probe` stages;
- the `spike-bolt` type;
- the PDLC, ASDLC and STBLC prose;
- the bank templates.

## Stories

- [engine/012 planning-stages](../../stories/012-planning-stages.md)
- [engine/013 bank-templates](../../stories/013-bank-templates.md)
- [engine/014 spike-bolt-type](../../stories/014-spike-bolt-type.md)

Wave: W2 (builds beside 004, merges after it).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §4.1, §6.1, §6.3 | — |
| lld | system-engineer | low-level design (stage `after` semantics with `merge`) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-2.1[templates], AC-2.2[templates], AC-2.3[planning prose], AC-2.4, AC-3.1 to AC-3.4, AC-4.1[spike], AC-4.2[planning], AC-4.4[spike]; plus the Definition of Done, including `ATTRIBUTION.md` lines for the templates adapted from specsmd.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It may start in parallel with 004 but merges after it (R-6). `requires_bolts` stays `[002]`; the remaining conflict is resolved by the hunk split and one array line in `validate`.
- It does not touch `orchestrator.md` or `agent-invocation`; the orchestrator's stage text is bolt 006's.
- Bolt 013 merges before this bolt: the root `ATTRIBUTION.md` is created by 013 and appended here.
- Reader pages (R-9): it sends *Docs update* requests to bolt 004's docs stage instead of editing README or `docs/plugins.md`.
- `spike-bolt` is tested with `producesCode: false` against a fixture that combines the new type with the `building` flags bolt 002 adds.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `WF/workflow.json` (lines 49 to 167: the three stages, `architecture.after`, `spike-bolt`), `WF/workflow.mjs` (about +30, the `unit-design` ordering warning), `E/skills/ai-dlc/SKILL.md` (table rows 82 to 84 and the PDLC, ASDLC and STBLC section, lines 104 to 116), `E/agents/{software-architect,product-manager,software-engineer,system-engineer,product-owner,requirement-analyst}.md`, `E/skills/task-triage/SKILL.md` and its `references/out-of-scope.md`, `E/skills/architecture-narrative/SKILL.md`, `E/skills/architecture-review/SKILL.md`, `E/skills/write-documentation/SKILL.md` (template links only; 003 merged earlier), the root `E/ATTRIBUTION.md` (append).
- Creates: the bank templates in `E/skills/write-documentation/templates/bank/` (F-11), `tests/workflow/{planning-stages,bolt-types-spike}.test.mjs`, `tests/fixtures/preview1-gates.mjs` (captured once from `47a3480`; S-6).
- Must not touch: `orchestrator.md`, `agent-invocation` (R-6).
