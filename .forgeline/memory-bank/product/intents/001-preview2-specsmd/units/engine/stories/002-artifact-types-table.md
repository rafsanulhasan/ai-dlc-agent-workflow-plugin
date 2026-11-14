---
id: 002-artifact-types-table
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 002-engine-contract-tooling
created: 2026-11-14
---

# engine/002 — One table that gives each artifact type one home

**Planned:** nothing here is built yet. The story belongs to [bolt 002-engine-contract-tooling](../bolts/002-engine-contract-tooling/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer, I want one table that gives each artifact type exactly one home, checked by `validate`, so that every tool resolves bank paths the same way.

## Acceptance criteria

- AC-1.2
- AC-1.3
- AC-1.4
- AC-1.5[contract]
- AC-1.6[map]
- AC-5.1
- AC-8.1
- AC-8.5

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- `ARTIFACT_TYPES` has 13 rows with the columns `legacy`, `bank` and `required` (§2.3). The old-to-new map of §3 is its `legacy` and `bank` columns.
- The schema adds an `if/then` for `intents`, and `additionalProperties: false` stays.
- It brings the area rule, the overlap rule, `rootOf`, the `artifacts [--json]` command and the key-equality test (AC-8.1).
- `workflow.mjs` is made importable in this bolt: an `IS_MAIN` guard runs the CLI only when the file is executed, `LEVELS` and `ENV` become a memoised `envLevels()`, and the pure functions are exported (spec §2.3 as revised by r1). It stays one file; the no-`lib/` decision is final in this bolt's lld.
- `tests/helpers/paths.mjs` is created here with today's values, for new tests only.
- O-12 is closed: the new `--json` outputs are CLI reports and carry no `{data, error}` envelope.
