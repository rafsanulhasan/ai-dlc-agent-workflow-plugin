---
id: 012-planning-stages
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 005-engine-planning-stages
created: 2026-11-14
---

# engine/012 — The unit-design, bolt-design and probe stages

**Planned:** nothing here is built yet. The story belongs to [bolt 005-engine-planning-stages](../bolts/005-engine-planning-stages/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the orchestrator planning an intent, I want the `unit-design`, `bolt-design` and `probe` stages, so that units and bolts are designed before G2 and G3, and live facts are probed safely.

## Acceptance criteria

- AC-3.1
- AC-3.2
- AC-3.3
- AC-3.4
- AC-4.2[planning]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It covers the stages of §6.3, the template change `architecture.after = ["unit-design"]`, and the `validate` warning on a merged project that lacks it.
- It includes the gate-set equality test (AC-3.3). The preview1 gate set is a stored fixture, `tests/fixtures/preview1-gates.mjs`, captured once from commit `47a3480`; CI reads no git history (shallow checkout) (S-6).
- It updates the PDLC, ASDLC and STBLC prose in the `ai-dlc` skill.
- It updates the agent text of the architect, product-manager, software-engineer (`probe`) and system-engineer.
- It does not edit `orchestrator.md` or `agent-invocation` (R-6).
