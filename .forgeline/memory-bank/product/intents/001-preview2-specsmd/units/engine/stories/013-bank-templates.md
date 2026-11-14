---
id: 013-bank-templates
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 005-engine-planning-stages
created: 2026-11-14
---

# engine/013 — Templates for the bank files

**Planned:** nothing here is built yet. The story belongs to [bolt 005-engine-planning-stages](../bolts/005-engine-planning-stages/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As `documentation-writer`, I want templates for the intent files, the unit brief, the story and `bolt.md`, so that bank files carry the §4.1 front matter and one status vocabulary.

## Acceptance criteria

- AC-2.1[templates]
- AC-2.2[templates]
- AC-2.3[planning prose]
- AC-2.4

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- `bolt.md` gets a *Stages* table with the columns stage, step code and artifact.
- The templates live in `skills/write-documentation/templates/bank/` of the engine plugin, one file per bank artifact named after its bank path (`intent/requirements.md`, `intent/units.md` or the intent files §4.1 lists, `unit-brief.md`, `story.md`, `bolt.md`), linked from `write-documentation/SKILL.md` (F-11; software-architect, 1.1.28 §2). They are read from the plugin when a file is written; `init` only scaffolds folders.
- The templates are adapted from specsmd, so the root `ATTRIBUTION.md` gets a line for each (DoD, AC-12.3).
