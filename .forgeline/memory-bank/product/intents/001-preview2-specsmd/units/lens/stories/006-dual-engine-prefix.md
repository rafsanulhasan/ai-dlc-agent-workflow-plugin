---
id: 006-dual-engine-prefix
unit: lens
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 010-lens-rename
created: 2026-11-14
---

# lens/006 — Old runs show agents under `ai-dlc:` or `engine:`

**Planned:** nothing here is built yet. The story belongs to [bolt 010-lens-rename](../bolts/010-lens-rename/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a lens user with pre-rename runs, I want the lens to show agents whether their records say `ai-dlc:` or `engine:`, so that old runs display unchanged for one release.

## Acceptance criteria

- AC-17.11
- AC-15.8[lens-rename]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It brings `hooks/engine-names.ts` (`ENGINE_PLUGIN`, `LEGACY_ENGINE_PLUGINS`, `engineRole`, `typeOfWorker`, `LEGACY_PANE_IDS`) and the roster path with its fallback.
- The marker goes on `LEGACY_ENGINE_PLUGINS` and `LEGACY_PANE_IDS`.
