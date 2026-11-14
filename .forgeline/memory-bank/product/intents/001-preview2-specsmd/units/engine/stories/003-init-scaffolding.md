---
id: 003-init-scaffolding
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 002-engine-contract-tooling
created: 2026-11-14
---

# engine/003 — `init` creates the bank and run folders

**Planned:** nothing here is built yet. The story belongs to [bolt 002-engine-contract-tooling](../bolts/002-engine-contract-tooling/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer starting a repository, I want `init` to create the bank and run folders with a preview2 `artifacts` block, so that new repositories start on the new layout.

## Acceptance criteria

- AC-1.1
- AC-8.2[scaffold]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- `init` creates `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` with `.gitkeep` files, which are exempt from the single-writer rule.
- `validate` exits 0 on the result.
- `init` is a skill an agent runs, so no node test runs it. The test is a static assertion that `init/SKILL.md` names the three folders and `.gitkeep`, plus a fixture repository on which `validate` exits 0. The end-to-end walk is ITEM-122's (AC-14.7, closed by ITEM-122).
- The `/engine:init` name is AC-8.2[name], in engine/019.
