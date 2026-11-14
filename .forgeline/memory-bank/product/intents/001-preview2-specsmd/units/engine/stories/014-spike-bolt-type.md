---
id: 014-spike-bolt-type
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 005-engine-planning-stages
created: 2026-11-14
---

# engine/014 — The spike-bolt type

**Planned:** nothing here is built yet. The story belongs to [bolt 005-engine-planning-stages](../bolts/005-engine-planning-stages/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the orchestrator, I want `spike-bolt` defined over ASDLC research, probe and architecture, so that spikes are typed bolts that produce knowledge only.

## Acceptance criteria

- AC-4.1[spike]
- AC-4.4[spike]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- The definition is `{stages: [research, probe, architecture], after: {architecture: [research, probe]}}` with `producesCode: false`.
- The optional `time_box` front-matter key is a string `<n>d` (whole working days, for example `2d`). It is a convention and `validate` does not check it (R-10; C2, step 1.1.30.2). The bolt template shows `2d`.
