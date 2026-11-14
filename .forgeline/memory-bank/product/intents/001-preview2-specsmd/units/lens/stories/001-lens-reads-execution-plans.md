---
id: 001-lens-reads-execution-plans
unit: lens
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 008-lens-new-paths
created: 2026-11-14
---

# lens/001 — The lens lists runs under `execution-plans/`

**Planned:** nothing here is built yet. The story belongs to [bolt 008-lens-new-paths](../bolts/008-lens-new-paths/bolt.md), which has not started (G3 pending).

## Story

As a lens user, I want the lens to list runs under `execution-plans/`, read verdicts and escalations, and flag gates that are waiting or rejected, so that I see the new runs live.

## Acceptance criteria

- AC-9.2
- AC-1.6[lens]
- AC-6.5[lens]
- AC-9.5[lens]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- A new `record.ts` (`parseRecordName`, `RECORD_TYPES`) replaces the three regexes. It has a byte copy of the canonical `record-names.mjs` in `tests/fixtures/grammar/`, checked by the drift test from bolt 002 and, against the code, by `plugin test`.
- The lens implements no G-FM (C-3). Its `frontMatter` reader stays, and the `decision:` read of a `.verdict.md` works with it.
- The `gateWaiting` and `gateRejected` anomalies apply only to runs that have event files.
- The lens's legacy-path strings change (the lens part of ITEM-117).
- The tests stay in `plugins/claude/ai-dlc-lens/tests/` until bolt 010 moves the folder.
- The [lens] part of AC-9.5 is that the lens `plugin test` passes.
