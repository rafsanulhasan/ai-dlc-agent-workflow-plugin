---
id: 020-keepalive-commands
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 009-engine-rename
created: 2026-11-14
---

# engine/020 — Keep-alive commands under `engine:`

**Planned:** nothing here is built yet. The story belongs to [bolt 009-engine-rename](../bolts/009-engine-rename/bolt.md), which has not started (G3 pending).

## Story

As a user, I want the keep-alive commands under `engine:`, with the lens toggle as the engine skill `cache-keepalive-lens`, so that keep-alive stays an engine feature (D24, D28).

## Acceptance criteria

- AC-17.5[engine]
- AC-17.13[keepalive-skill]
- AC-16.2[009]
- AC-9.5[rename]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It sets the constants `engine:cache-keepalive`, `engine:cache-keepalive-configure` and `engine:cache-keepalive-lens`, with a test that each equals its skill's name.
- The `lens-keepalive` skill becomes `cache-keepalive-lens` and stays in `claude-only-skills.json`.
- The shared state namespace follows spike (e).
- Both hooks folders get an `ATTRIBUTION.md` entry.
