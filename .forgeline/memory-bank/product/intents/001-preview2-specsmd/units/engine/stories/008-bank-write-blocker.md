---
id: 008-bank-write-blocker
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 003-engine-authorship-rule
created: 2026-11-14
---

# engine/008 — A bank file in another agent's change set is a Blocker

**Planned:** nothing here is built yet. The story belongs to [bolt 003-engine-authorship-rule](../bolts/003-engine-authorship-rule/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a reviewer, I want a bank file in a non-`documentation-writer` change set to be a Blocker, and every bank change critiqued, so that the single-writer rule is enforced.

## Acceptance criteria

- AC-7.3
- AC-7.7

## Technical notes

- The check goes in the `review` skill and in the brutal-critique text.
- The orchestrator's docs-stage text gets the critique-before-done rule.
