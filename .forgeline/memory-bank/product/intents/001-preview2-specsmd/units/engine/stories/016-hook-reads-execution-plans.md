---
id: 016-hook-reads-execution-plans
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 007-engine-handoff-hook
created: 2026-11-14
---

# engine/016 — Auto-handoff reads `execution-plans/` and the new record names

**Planned:** nothing here is built yet. The story belongs to [bolt 007-engine-handoff-hook](../bolts/007-engine-handoff-hook/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a developer whose session runs out of context, I want auto-handoff to find runs under `execution-plans/` and read the new record names, so that the session handoff names my run.

## Acceptance criteria

- AC-9.1
- AC-1.6[hook]
- AC-6.5[hook]
- AC-9.5[hook]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- A new `record.ts` (G-REC: `parseRecordName`, `RECORD_TYPES`) replaces the hook's `CODE` regex. Its byte copy of the canonical `record-names.mjs` is checked by the drift test from bolt 002 and, against the code, by `plugin test`.
- `answerOf` implements the pairing rules, and open work no longer counts `-to-human.escalation.md`.
- The hook implements no G-FM (C-3); it keeps `parseRunState`.
- `hooks/auto-handoff/ATTRIBUTION.md` gets an entry.
- No new watcher or timer (AC-6.5).
