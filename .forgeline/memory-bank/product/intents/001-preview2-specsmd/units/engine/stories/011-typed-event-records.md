---
id: 011-typed-event-records
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 004-engine-events
created: 2026-11-14
---

# engine/011 — Each record file is a typed event that `validate` checks

**Planned:** nothing here is built yet. The story belongs to [bolt 004-engine-events](../bolts/004-engine-events/bolt.md), which has not started (G3 pending).

## Story

As the orchestrator, I want each record file to be a typed event that `validate` checks, so that runs are auditable with no runtime.

## Acceptance criteria

- AC-6.1
- AC-6.2
- AC-6.3
- AC-6.4
- AC-6.5[contract]
- AC-6.6

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It brings G-REC: `parseRecordName` and `RECORD_TYPES`.
- The canonical vector file is `tests/fixtures/grammar/record-names.mjs`. Its accept list is generated once from the record names that exist in `docs/handoffs/**` and `execution-plans/**` (every distinct shape, including `.l1.2` and `.h1` suffixes) and checked in as data, so it includes every name accepted today.
- It brings `EVENT_RULES` and `event.schema.json`, which `init` installs, with a drift test that the schema's `oneOf` equals `EVENT_RULES`.
- It brings the `events` command and the opt-in `events: 1` flag.
- `validate` rejects an `agents.custom` id that has a `to` part.
- The human's acceptance of the spike hand-back (a `.verdict.md` in the exact §8.3 shape) is copied into the `events` tests as one valid vector (R-11).
