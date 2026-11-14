---
id: 005-lens-commands-and-panes
unit: lens
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 010-lens-rename
created: 2026-11-14
---

# lens/005 — `/lens:*` commands and `lens-*` panes

**Planned:** nothing here is built yet. The story belongs to [bolt 010-lens-rename](../bolts/010-lens-rename/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a lens user, I want `/lens:show|configure|init|kit|gate` and panes named `lens-*`, with old panes closed, so that the commands and panes follow the plugin name (D31, D33, D37, D41).

## Acceptance criteria

- AC-17.13[lens]
- AC-17.5[lens]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The five skills move and are renamed, and leave `claude-only-skills.json`.
- The `CMD` map gets a folder-name test.
- The lens answers `engine:cache-keepalive-lens`. `KEEPALIVE_COMMAND` and the gate hint change.
- A new `identity.ts` holds `LENS_STATE_NS = 'lens'` and the pane ids `lens-*`. It is introduced with today's values first and flipped second, so every pane id and atom namespace has one home.
- `LEGACY_PANE_IDS` lives in `engine-names.ts` (story lens/006), is closed at load, and carries the fallback marker.
- Spike findings (e), (h) and (i) apply, and the bolt's success criteria cite them (R-3).
