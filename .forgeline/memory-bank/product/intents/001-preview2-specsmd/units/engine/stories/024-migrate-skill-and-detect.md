---
id: 024-migrate-skill-and-detect
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 014-engine-migrate-settings
created: 2026-11-14
---

# engine/024 — The `/engine:migrate` skill and the detect-and-warn

**Planned:** nothing here is built yet. The story belongs to [bolt 014-engine-migrate-settings](../bolts/014-engine-migrate-settings/bolt.md), which has not started (G3 pending).

## Story

As a maintainer, I want `/engine:migrate` to guide the upgrade, and `validate` to tell me when it's still needed, so that nobody runs on half-renamed state.

## Acceptance criteria

- AC-11.1[skill]
- AC-16.2[014]
- AC-17.12
- AC-15.8[detect]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The skill is `skills/migrate/SKILL.md` with `disable-model-invocation: true`. It ships to Copilot, so it is not in `claude-only-skills.json`.
- It follows the flow of §10.4.
- It brings the remaining `merge` guards and the `upgrade` split (SA-C3). The `artifacts` merge guard is already in bolt 002.
- It adds the `validate` detect-and-warn, with the marker.
- The guide part of AC-11.1 belongs to ITEM-123.
