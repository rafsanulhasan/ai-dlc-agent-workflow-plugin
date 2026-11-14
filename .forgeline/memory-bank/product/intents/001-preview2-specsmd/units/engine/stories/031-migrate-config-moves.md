---
id: 031-migrate-config-moves
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 014-engine-migrate-settings
created: 2026-11-14
---

# engine/031 — `/engine:migrate` moves the `.ai-dlc/` config files

**Planned:** nothing here is built yet. The story belongs to [bolt 014-engine-migrate-settings](../bolts/014-engine-migrate-settings/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer of a preview1 repository, I want `/engine:migrate` to move my `.ai-dlc/` config files to their new homes, so that the one command brings the whole repository to the preview2 layout.

## Acceptance criteria

- AC-18.9 (ITEM-127 AC-9; G1 amendment D69, approved at G3, 2026-11-14 (D80))
- ITEM-118 AC-12 (item-level)

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The command moves `.ai-dlc/*` per `CONFIG_PATHS` (bolt 015; the sub-layout of D70), applies D39 (drop a legacy file when the target holds an identical copy) and keeps the ADR-0013 order (tooling, then migrate, then the merge, then the `init` block refresh).
- `--dry-run` lists every move.
- It is a new planner entry beside the ones of bolt 012, and the story stays in bolt 014 so that 012 stays non-blocking (D72).
