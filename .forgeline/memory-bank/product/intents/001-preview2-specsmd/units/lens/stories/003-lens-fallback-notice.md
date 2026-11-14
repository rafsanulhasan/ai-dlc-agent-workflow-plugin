---
id: 003-lens-fallback-notice
unit: lens
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 008-lens-new-paths
created: 2026-11-14
---

# lens/003 — The lens keeps reading `docs/handoffs/`, with one notice per scan

**Planned:** nothing here is built yet. The story belongs to [bolt 008-lens-new-paths](../bolts/008-lens-new-paths/bolt.md), which has not started (G3 pending).

## Story

As a lens user on a preview1 repository, I want the lens to keep reading `docs/handoffs/`, with one notice per scan, so that I'm told to migrate.

## Acceptance criteria

- AC-9.4[lens]
- AC-15.1[lens]
- AC-15.2[lens]
- AC-15.3[lens]
- AC-15.4[lens]
- AC-15.5[lens]
- AC-15.6[lens]
- AC-15.7[lens]
- AC-15.8[lens]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- A new `runs-root.ts` holds `resolveRunsRoot` (with the per-key rule, D42), the formatter and `MIGRATE_ENTRY` (`/engine:migrate --dry-run`, its final name from the first commit); it replaces `handoffsRoot` and keeps `depth`. It is a file of its own because it ends at 1.0.0. Byte copies of `runs-root.mjs` and `fallback-warning.mjs` are checked by the drift test and by `plugin test`.
- The scan writes one entry to the log and one to the `/lens:gate` skipped list.
- O-4 is decided (product-owner, 1.1.25, D43): a lens scan is one invocation, and its one warning is the log entry plus the `skipped` entry. The toast is a display echo, deduplicated by text per session: a session shows at most one toast for the same text, on the first scan that hits the fallback.
- The AC-15.7 test asserts that two legacy reads in one scan give one log entry and one `skipped` entry, and that a session shows at most one toast for the same text.
