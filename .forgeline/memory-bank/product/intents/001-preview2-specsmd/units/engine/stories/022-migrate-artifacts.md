---
id: 022-migrate-artifacts
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 012-engine-migrate-plan
created: 2026-11-14
---

# engine/022 — One command moves the artifacts to their new homes

**Planned:** nothing here is built yet. The story belongs to [bolt 012-engine-migrate-plan](../bolts/012-engine-migrate-plan/bolt.md), which has not started (G3 pending).

## Story

As a maintainer of a preview1 repository, I want one command to move my artifacts to the new homes, keeping their history and stopping on conflicts, so that the upgrade is safe and repeatable.

## Acceptance criteria

- AC-1.5[migrate]
- AC-1.6[migrate]
- AC-11.2
- AC-11.3
- AC-11.4
- AC-11.5
- AC-11.6
- AC-11.7
- AC-11.8
- AC-11.9
- AC-11.11

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It brings `planMigration` as an ordered list of planners (detect, artifacts, memory, settings, commit point; §10.2 steps 1 to 3 and 6), with the memory and settings planners present as empty entries, and `applyPlan`.
- It fixes the whole dry-run `migrate --dry-run --json` `kind` enum, including `memory-move`, `memory-merge`, `settings-rewrite` and `advice`, so bolt 014 changes no shape that this bolt's tests assert.
- The residue rule: residue is a non-empty legacy default path of a key whose configured value is already its new path. When `src` equals `dst`, the source is the legacy default instead, as residue (AC-11.7 applied to a mixed block, D42). Fixture F13 is a mixed block with `docs/handoffs/` and `execution-plans/` both non-empty.
- All conflicts are reported before any write. Tracked files move with `git mv`. An identical duplicate is dropped (D39). It has a dry run and is idempotent.
- Fixtures F1 to F6, F12 and F13 are temporary git repositories that must behave the same on Windows and Linux (see the bolt's notes).
- Code that ends at 1.0.0 lives in files of its own where the code base allows.
