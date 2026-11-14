---
id: 004-cli-legacy-fallback
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 002-engine-contract-tooling
created: 2026-11-14
---

# engine/004 — `workflow.mjs` keeps reading legacy paths, with one warning

**Planned:** nothing here is built yet. The story belongs to [bolt 002-engine-contract-tooling](../bolts/002-engine-contract-tooling/bolt.md), which has not started (G3 pending).

## Story

As a maintainer of a preview1 repository, I want `workflow.mjs` to keep reading the legacy paths, with exactly one warning, so that I can update the tooling before I migrate.

## Acceptance criteria

- AC-8.4
- AC-15.1[cli]
- AC-15.2[cli]
- AC-15.3[cli]
- AC-15.4[cli]
- AC-15.5[cli]
- AC-15.6[cli]
- AC-15.7[cli]
- AC-15.8[cli]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It brings `resolveRunsRoot` with the per-key rule (D42) and the mixed-layout row, and `formatFallbackWarning` (§9). Both sit in the one LEGACY section of `workflow.mjs`.
- The canonical vectors are `.mjs` modules in `tests/fixtures/grammar/`: `fallback-warning.mjs` (each case carries a `channel`: `cli`, `hook` or `lens`) and `runs-root.mjs` (C-4). The byte copies and their code arrive in 007 and 008.
- The one convention-based drift test, `tests/grammar-vectors-drift.test.mjs`, is written here (C-5), so 007 and 008 never edit it. A node test recomputes the expected roots of `runs-root.mjs` from `ARTIFACT_TYPES`.
- The `artifacts` merge guard is delivered here (C-2): `workflow.mjs merge` skips `artifacts` while the layout is legacy and prints `artifacts: legacy layout — run migrate first`. From the moment this bolt gives the template 13 `artifacts` keys, a `merge` or `upgrade` on a legacy or mixed block (this repository, D42) would otherwise add `intents` and flip the layout. The remaining guards and the `upgrade` split are engine/024's.
- One `MIGRATE_ENTRY` constant holds the final name from its first commit (`node .ai-dlc/workflow.mjs migrate --dry-run (or the migrate skill)`), so bolts 009 and 010 do not change it. The vectors use a placeholder `entry`.
- One exit handler writes the warning to stderr, and the exit code does not change.
- Every legacy branch carries `// fallback: remove in 1.0.0`.
