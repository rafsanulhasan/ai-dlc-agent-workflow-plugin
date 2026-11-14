---
id: 017-hook-fallback-warning
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 007-engine-handoff-hook
created: 2026-11-14
---

# engine/017 — The hook keeps reading `docs/handoffs/`, with one notice

**Planned:** nothing here is built yet. The story belongs to [bolt 007-engine-handoff-hook](../bolts/007-engine-handoff-hook/bolt.md), which has not started (G3 pending).

## Story

As a developer on a preview1 repository, I want the hook to keep reading `docs/handoffs/`, with one notice per firing, so that I'm told to migrate without being blocked.

## Acceptance criteria

- AC-9.4[hook]
- AC-15.1[hook]
- AC-15.2[hook]
- AC-15.3[hook]
- AC-15.4[hook]
- AC-15.5[hook]
- AC-15.6[hook]
- AC-15.7[hook]
- AC-15.8[hook]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- A new `runs-root.ts` holds the hook's resolver (with the per-key rule), the formatter and `MIGRATE_ENTRY` (`/engine:migrate --dry-run`, its final name from the first commit). It is a file of its own because it ends at 1.0.0. Byte copies of `runs-root.mjs` and `fallback-warning.mjs` are checked by the drift test and by `plugin test`.
- The notice goes through the existing channel: a log line, a `warn` panel step, and a toast where the band is not drawn.
- The preview1 hook already takes the runs root from `artifacts.handoffs`, so with D42 this bolt can be tested live on this repository, with no pre-rename checkout.
