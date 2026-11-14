---
id: 002-run-state-file-names
unit: lens
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 008-lens-new-paths
created: 2026-11-14
---

# lens/002 — Messages name the actual run-state file

**Planned:** nothing here is built yet. The story belongs to [bolt 008-lens-new-paths](../bolts/008-lens-new-paths/bolt.md), which has not started (G3 pending).

## Story

As a lens user, I want messages to name the actual run-state file, so that a skipped run is easy to fix.

## Acceptance criteria

- AC-9.3

## Technical notes

- The new signature is `detectRun(dir, run, files, now)`.
- Six text sites say "run state" instead of "run.md".
