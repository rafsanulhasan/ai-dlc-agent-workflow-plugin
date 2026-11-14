---
id: 023-migrate-memory-and-settings
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 014-engine-migrate-settings
created: 2026-11-14
---

# engine/023 — Memory folders and settings move to the new names

**Planned:** nothing here is built yet. The story belongs to [bolt 014-engine-migrate-settings](../bolts/014-engine-migrate-settings/bolt.md), which has not started (G3 pending).

## Story

As a maintainer, I want my agent memory folders and settings moved to the new names, with other marketplaces left alone, so that my team keeps its memory and its settings.

## Acceptance criteria

- AC-17.10 (a) to (i)

## Technical notes

- It fills the planners that bolt 012 left empty (§10.2 steps 4 and 5) and never reorders them.
- The memory-folder pattern follows spike (a), in one function (`memoryFolderOf`).
- The `MEMORY.md` union follows O-9 (system-engineer).
- The settings rewrite rules are those of §10.2 step 5, in one `SETTINGS_RULES` table, and O-10 applies.
- Another marketplace's entries get `advice:` lines only; user-level and managed settings get advice only (D39).
- The text must still parse after the rewrite. Fixtures F7 to F11.
