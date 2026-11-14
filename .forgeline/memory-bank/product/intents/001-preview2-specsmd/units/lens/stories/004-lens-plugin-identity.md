---
id: 004-lens-plugin-identity
unit: lens
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 010-lens-rename
created: 2026-11-14
---

# lens/004 — The plugin is `lens`, in `forgeline`

**Planned:** nothing here is built yet. The story belongs to [bolt 010-lens-rename](../bolts/010-lens-rename/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a lens user, I want the plugin to be `lens` in `forgeline`, so that its names match the product (D31).

## Acceptance criteria

- AC-17.1[lens]
- AC-17.2[lens]
- AC-16.2[010]
- AC-16.4[010]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The folder moves with `git mv` to `plugins/claude/lens/`.
- It changes the lens's own registration entries (the marketplace entry, the `claude-only-plugins` line, the two CI steps, `LENS_PLUGIN` and `LENS_DIR`).
- It updates the literals in the lens-owned existing tests, `tests/lens-renderer/` and `tests/cache-reader/`, and the lens lines of the agent artifacts that bolt 009 changed, if any (R-14).
- The [lens] part of AC-17.2 checks that `plugins/claude/ai-dlc-lens/` is gone.
