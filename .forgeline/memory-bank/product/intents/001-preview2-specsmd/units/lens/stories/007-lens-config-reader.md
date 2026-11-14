---
id: 007-lens-config-reader
unit: lens
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# lens/007 — The lens reads its config files from their `CONFIG_PATHS` places

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../../engine/bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a lens user, I want the lens to read every config file it uses (`lens.json`, `workflow.json`, `model-metadata.json` and `model-costing.json`) from its new place, with the old path as a one-release fallback, so that the move of the config folders does not reset my settings.

## Acceptance criteria

- AC-18.4[lens] (ITEM-127 AC-4; G1 amendment D69, approved at G3, 2026-11-14 (D80))
- AC-15.8[forgeline-root-lens]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- Every lens read of a `CONFIG_PATHS` source is covered: `settings.ts` (`lens.json`, `model-metadata.json`, `model-costing.json`), `register.tsx` (`workflow.json`, `lens.json`), `lens.ts` and `anomaly.ts`, with their tests (the final list is the output of story 027). Each has cases (a), (b) and (c) of AC-18.4: the new path is read first; with only the old path the lens reads it, warns once and carries the marker `fallback: remove in 1.0.0`.
- The lens unit owns AC-18.4[lens]. The story is built inside the engine bolt 015 because bolt 010 requires 015 and the config map is the engine's; this is the one cross-unit exception (the intent's `units.md`).
