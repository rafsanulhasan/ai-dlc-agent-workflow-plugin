---
id: 001-rename-platform-facts
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 001-engine-rename-spike
created: 2026-11-14
---

# engine/001 — Platform facts the rename depends on

**Planned:** nothing here is built yet. The story belongs to [bolt 001-engine-rename-spike](../bolts/001-engine-rename-spike/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the engine maintainers, we want the platform behaviour the rename depends on observed live in Claude Code, so that bolts 009, 010 and 014 build on recorded facts.

## Acceptance criteria

- AC-17.14, whole, including finding (c) (R-3; product-owner, 1.1.25, D43)

## Technical notes

- It uses a scratch marketplace under `.scratch/`, and the hand-back quotes the Claude Code version.
- It records findings (a) to (i) from spec §16.
- Findings (c), (e), (h) and (i) are consumed by lens bolt 010 through `requires_bolts: [001-engine-rename-spike, …]`. The spike hand-back and the research note label them as lens-consumed, and bolt 010's success criteria and notes cite them. If finding (c) fails, it goes to the human as a new decision.
- "The migration bolt" in AC-17.14 means bolt 014, the spike-dependent half of the old bolt 012 (C1, product-owner, step 1.1.30.1).
- The probe writes no tracked file; one tracked file in its change set is a Blocker (§6.3).
- A difference from the spec goes through `spec-driven-development` before bolt 009 starts.
- The research note is `memory-bank/project/research/001-engine-rename-spike.md`, written by `documentation-writer`.
- It answers open items O-13 and O-23.
