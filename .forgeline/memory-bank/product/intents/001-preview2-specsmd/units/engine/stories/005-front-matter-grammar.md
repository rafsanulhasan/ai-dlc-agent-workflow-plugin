---
id: 005-front-matter-grammar
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 002-engine-contract-tooling
created: 2026-11-14
---

# engine/005 — One front-matter grammar and narrow id checks

**Planned:** nothing here is built yet. The story belongs to [bolt 002-engine-contract-tooling](../bolts/002-engine-contract-tooling/bolt.md), which has not started (G3 pending).

## Story

As `validate`, I need one front-matter grammar and narrow id checks, so that bank files are parsed the same way every time.

## Acceptance criteria

- AC-2.1[validate]
- AC-2.2[validate]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- `parseFrontMatter` has a strict and a lenient mode (§4.2). In preview2 `workflow.mjs` is the only implementation: bank files are parsed by `workflow.mjs`, and the hook and the lens keep their preview1 readers of run-state and record front matter (C-3). A code base that starts reading bank-file front matter adopts G-FM and joins the vector set with a byte copy.
- The canonical vector file is `tests/fixtures/grammar/front-matter.mjs`, with no copies.
- The C-5 checks: the id equals its folder name or file stem, the status is in the §5 vocabulary, and the bolt `type` is a `boltTypes` key.
- The checks apply only to a preview2 layout.
- `time_box` is a convention (`<n>d`) and is not validated (C2, software-architect, step 1.1.30.2).
