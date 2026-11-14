---
id: 027-config-path-sweep
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# engine/027 — Every `.ai-dlc/` and `memory-bank/` literal is found before it is changed

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer, I want a four-pass sweep of every `.ai-dlc/` and `memory-bank/` literal, so that bolt 015 changes each one once and knows what it leaves alone.

## Acceptance criteria

- ITEM-127 AC-2 (traced to AC-18.2 and AC-18.8). The story produces evidence only (the allowlist and the file list); AC-18.8 itself is delivered by bolt 011

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The four-pass sweep that 8.1.1 left PARTIAL: agents, every skill, `tests/workflow`, `tests/model-metadata`, the hooks modules and the lens.
- It produces the allowlist and the file list this bolt edits. The orchestrator spawns `research-assistant` for it before `design`.
