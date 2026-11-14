---
id: 015-bolt-types-in-build-lifecycles
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 006-engine-build-stages
created: 2026-11-14
---

# engine/015 — Bolt types applied in the build lifecycles

**Planned:** nothing here is built yet. The story belongs to [bolt 006-engine-build-stages](../bolts/006-engine-build-stages/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As the orchestrator running a bolt, I want the routing and lifecycle text to apply the bolt type and its skip rule, so that a bolt runs only the stages of its type, in `after` order.

## Acceptance criteria

- AC-2.3[build prose]
- AC-4.2[build]

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It changes the orchestrator body (the *Bolts* section of the execution plan, and the skip recorded in the handoff), `request-routing`, the `ai-dlc` skill, and the FDLC, BFLC, RLC and AAW prose.
- It takes the leftover legacy-path files (S-7), one hit each: the `SKILL.md` of `fix-bug`, `implement-feature`, `playwright-mcp-ui-testing`, `ts-playwright-ui-testing` and `tunit-playwright-ui-testing`, and `agents/sqa-engineer.md` and `agents/agent-manager.md`.
