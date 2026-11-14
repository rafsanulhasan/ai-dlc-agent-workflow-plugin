---
id: 007-bank-is-documentation
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 003-engine-authorship-rule
created: 2026-11-14
---

# engine/007 — The bank is documentation, with one writer

**Planned:** nothing here is built yet. The story belongs to [bolt 003-engine-authorship-rule](../bolts/003-engine-authorship-rule/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As `documentation-writer` and every stage agent, we want the rule to say that the bank is documentation, that it has one writer, and that "done" means engineering plus knowledge, so that bank content stays true to the run state.

## Acceptance criteria

- AC-2.5
- AC-7.1
- AC-7.2
- AC-7.4
- AC-7.5
- AC-8.3

## Technical notes

- The three rule copies have identical bodies. The `.github/` twin is written by the harness sync.
- It covers the record-precedence rules of §5 with the worked example, that `execution-plans/` is not documentation, and the exemptions.
- The building stage is defined by the `building: true` flag, and the same text replaces the prose in `orchestrator.md`, `documentation-writer.md` and `write-documentation` (R-5). This repository's `.ai-dlc/workflow.json` has no flag until ITEM-121, so the rewritten prose keeps one sentence naming the preview1 meaning (`software-engineer`; `agent-manager` in AAW).
- `init` installs the rule (AC-8.3). `init` is a skill an agent runs, so no test runs it: see the `init` scaffolding test seam of spec §Test seams as revised by r1 (a static assertion on `init/SKILL.md`). The end-to-end walk is ITEM-122's (AC-14.7).
