---
unit: engine
intent: 001-preview2-specsmd
status: draft
default_bolt_type: simple-bolt
created: 2026-11-13
updated: 2026-11-14
---

# Unit brief — engine (intent 001-preview2-specsmd)

**Planned:** a proposal for G2 (steps 1.1.14 and 1.1.20); nothing here is built yet.

## Purpose

The AI-DLC team (agents, skills, workflow tooling), **including keep-alive and auto-handoff, which are engine features (D24)**, and the preview2 contract: the memory bank, intents/units/bolts, execution plans and events, the fallback, the `migrate` skill and the rename of the plugin to `engine`.

## Scope in

- `plugins/claude/engine/**` (today `plugins/claude/ai-dlc/`), except the lens's five command skills, and its generated Copilot twin.
- `hooks/auto-handoff` and `hooks/keepalive`.
- Skills: `cache-keepalive*`, including the new `cache-keepalive-lens` (D28); the new `migrate` (shipped to Copilot, `disable-model-invocation: true`); `workflow`; `init`; `docs-rules`.
- `tools/` (all of it, including `tools/stale-names.allowlist.json`), both marketplace files and `.github/workflows/validate.yml`; in the shared registration files, every entry except the lens's ([registry](../../../../units.md), Rules).
- `.ai-dlc/` templates (`workflow.mjs` and both schemas).
- `tests/`, except `tests/lens-renderer/` and `tests/cache-reader/`.

## Scope out

- The lens hooks module and its five skills.
- Any runtime or scheduler (D3).

## Functional requirements

FR-1 to FR-8 and FR-11, FR-12 in full; the engine parts of FR-9, FR-10, FR-15, FR-16 and FR-17 (AC-17.1 to AC-17.10, AC-17.12, AC-17.14). See [the unit decomposition](../../units.md).

## Depends on

Nothing. The lens depends on this unit.

## Constraints

Zero-dependency Node tooling; flat front matter; language-agnostic agents and generic skills; `node tools/build-copilot.mjs --check` passes.

## Success

Its acceptance criteria pass; spike 001 is recorded; each owning agent quotes the repository checks in its hand-back.

## Bolts

Bolts 001 to 007, 009, 011, 012 and 013 of the [draft bolt index](../../../../../project/plans/001-preview2-specsmd.tasks.md) (draft; finalised at G3).
