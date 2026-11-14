---
id: 019-engine-prefixes-and-init
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 009-engine-rename
created: 2026-11-14
---

# engine/019 — `engine:` prefixes everywhere, and `init` on the new names

**Planned:** nothing here is built yet. The story belongs to [bolt 009-engine-rename](../bolts/009-engine-rename/bolt.md), which has not started (G3 pending).

## Story

As a user, I want every agent and skill reference to use `engine:`, and `init` to write the new settings and memory folders, so that a new repository is fully on the new names.

## Acceptance criteria

- AC-17.6
- AC-8.2[name]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It changes the `engine:` and `/engine:` prefixes, `init` (`"agent": "engine:orchestrator"`, memory folders following spike (a)), and the text of `manage-memory`, `agent-management` and the build's platform note.
- `stripNamespace` (O-21) gets a build test: it strips `engine:` only before a known agent or skill id and after a non-word character.
