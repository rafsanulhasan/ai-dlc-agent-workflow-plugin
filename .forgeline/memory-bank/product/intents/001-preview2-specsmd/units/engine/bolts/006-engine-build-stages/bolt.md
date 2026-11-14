---
id: 006-engine-build-stages
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: draft
stories: [015-bolt-types-in-build-lifecycles]
requires_bolts: [005-engine-planning-stages]
enables_bolts: [009-engine-rename]
created: 2026-11-14
---

# Bolt 006-engine-build-stages

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

Wire the bolt types and the skip rule into the orchestrator, `request-routing`, the `ai-dlc` skill, and the FDLC, BFLC, RLC and AAW prose (ITEM-114 part b).

## Stories

- [engine/015 bolt-types-in-build-lifecycles](../../stories/015-bolt-types-in-build-lifecycles.md)

Wave: W3 (third in priority; needs 005 merged; gates 009).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| design | software-architect | design notes against §6.1 and the lifecycle prose | — |
| lld | system-engineer | low-level design (confirms whether `aaw-review.md` names the stage set) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-2.3[build prose] (the grep test from bolt 002 is green), AC-4.2[build]; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It requires 004 transitively, through the merge order of 005. The orchestrator text it changes was last changed by 004.
- No W3 bolt edits `workflow.mjs`, the template or the workflow tests, except bolt 012 (the only W3 bolt that may edit `workflow.mjs`).
- Bolt 009 starts when its `requires_bolts` are merged (006 gates it) and the spike hand-back is accepted.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `E/agents/orchestrator.md` (the *Bolts* section, the skip recorded in the handoff), `E/skills/request-routing/SKILL.md`, `E/skills/ai-dlc/SKILL.md` (the FDLC, BFLC, RLC and AAW sections), `E/skills/workflow/references/aaw-review.md` if it names the stage set.
- Leftover legacy paths (S-7), one hit each: `E/skills/{fix-bug,implement-feature,playwright-mcp-ui-testing,ts-playwright-ui-testing,tunit-playwright-ui-testing}/SKILL.md`, `E/agents/{sqa-engineer,agent-manager}.md`.
- Creates: none. The bolt-type-ids grep test from bolt 002 is its test.
