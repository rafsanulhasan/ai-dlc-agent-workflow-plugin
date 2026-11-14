---
id: 006-bolt-types-contract
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 002-engine-contract-tooling
created: 2026-11-14
---

# engine/006 — Bolt types defined once, as validated stage subsets

**Planned:** nothing here is built yet. The story belongs to [bolt 002-engine-contract-tooling](../bolts/002-engine-contract-tooling/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the orchestrator, I want bolt types defined once, as validated stage subsets with a skip rule, so that a bolt runs only its type's stages.

## Acceptance criteria

- AC-2.3[list]
- AC-4.1[construction, simple]
- AC-4.4[validate]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It adds the `boltTypes` key to the schema, and to the template with `construction-bolt` and `simple-bolt` only. `spike-bolt` arrives with `probe` in bolt 005 (R-4).
- It adds the `building: true` data flag on FDLC `build`, BFLC `fix`, RLC `refactor`, AAWH `change` and AAWP `change`. The prose that defines the building stage is engine/007's (R-5); bolt 002 merges before 003.
- It adds the §6.2 `validate` checks, including `producesCode: false` with a fixture, and the object form `{stages, after}` with fixtures.
- `show` lists each type's stages with their owners and artifacts.
- The AC-2.3 grep test lands here (`tests/workflow/bolt-type-ids.test.mjs`), rooted at `ENGINE_DIR` from `tests/helpers/paths.mjs` (R-7).
