---
id: 028-config-paths-map
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# engine/028 — One `CONFIG_PATHS` table, and the bank defaults under `.forgeline/`

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer, I want one `CONFIG_PATHS` table next to `ARTIFACT_TYPES`, so that migration, `init`, the hooks and the tests read the same old-to-new map.

## Acceptance criteria

- AC-18.2 and AC-18.3 (ITEM-127 AC-3; G1 amendment D69, approved at G3, 2026-11-14 (D80))

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The table maps `.ai-dlc/{workflow.json,workflow.mjs,workflow.schema.json,catalog.json,lens.json}` to `.forgeline/ai-dlc/`, `.ai-dlc/{cache-keepalive,auto-handoff}{,.schema}.json` to `.forgeline/cost-saving/` and `.ai-dlc/model-metadata{,.schema}.json` to `.forgeline/models/claude/metadata{,.schema}.json` (the sub-layout decided in D70). ADR-0018 places the files D70 does not name (at least `herdr.json`, `herdr.schema.json`, `lens.schema.json` and `model-costing.json` as moves, `event.schema.json` as a new file with no old path), and the table has a "new files" part for it (AC-18.2).
- The `ARTIFACT_TYPES` `bank` defaults are under `.forgeline/`, and the area rule reads `<bankRoot>/<area>/`.
- `validate` passes the area and overlap rules with `product` at `.forgeline/memory-bank/product/briefs/` (fixture).
