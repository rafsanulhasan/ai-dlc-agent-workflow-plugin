---
unit: engine
intent: 001-preview2-specsmd
status: ready
default_bolt_type: simple-bolt
created: 2026-11-13
updated: 2026-11-14
---

# Unit brief — engine (intent 001-preview2-specsmd)

**Planned:** approved at G2 (D38; the unit status is `ready`, which §5 of the spec maps to *planned*). Nothing here is built yet, and the bolts below are planned (status `ready`, G3 approved, 2026-11-14, D79).

## Purpose

The AI-DLC team (agents, skills, workflow tooling), **including keep-alive and auto-handoff, which are engine features (D24)**, and the preview2 contract: the memory bank, intents/units/bolts, execution plans and events, the fallback, the `migrate` skill and the rename of the plugin to `engine`.

## Scope in

- `plugins/claude/engine/**` (today `plugins/claude/ai-dlc/`), except the lens's five command skills, and its generated Copilot twin.
- `hooks/auto-handoff` and `hooks/keepalive`.
- Skills: `cache-keepalive*`, including the new `cache-keepalive-lens` (D28); the new `migrate` (shipped to Copilot, `disable-model-invocation: true`); `workflow`; `init`; `docs-rules`.
- `tools/` (all of it, including `tools/stale-names.allowlist.json`), both marketplace files and `.github/workflows/validate.yml`; in the shared registration files, every entry except the lens's ([registry](../../../../units.md), Rules).
- the workflow templates installed under `.forgeline/ai-dlc/` (`workflow.mjs` and both schemas; `.ai-dlc/` before FR-18).
- `tests/`, except `tests/lens-renderer/` and `tests/cache-reader/`.

## Scope out

- The lens hooks module and its five skills.
- Any runtime or scheduler (D3).

## Functional requirements

FR-1 to FR-8 and FR-11, FR-12 in full; the engine parts of FR-9, FR-10, FR-15, FR-16 and FR-17 (AC-17.1 to AC-17.10, AC-17.12, AC-17.14); FR-18 (AC-18.1 to AC-18.3, AC-18.4[engine], AC-18.5 to AC-18.12). See [the unit decomposition](../../units.md).

## Depends on

Nothing. The lens depends on this unit.

## Constraints

Zero-dependency Node tooling; flat front matter; language-agnostic agents and generic skills; `node tools/build-copilot.mjs --check` passes.

## Success

Its acceptance criteria pass; spike 001 is recorded; each owning agent quotes the repository checks in its hand-back.

## Bolts

Thirteen bolts of [the task plan](../../../../../project/plans/001-preview2-specsmd.tasks.md), each with a `bolt.md` and its stories (31 stories, `engine/001` to `engine/031`). All are status `ready` (planned): G3 was approved on 2026-11-14 (D79). Requires, waves and merge order are in the task plan and in each `bolt.md`.

| Bolt | Type | Stories | Wave |
|---|---|---|---|
| [001-engine-rename-spike](bolts/001-engine-rename-spike/bolt.md) | spike-bolt | [engine/001](stories/001-rename-platform-facts.md) | W1 |
| [002-engine-contract-tooling](bolts/002-engine-contract-tooling/bolt.md) | construction-bolt | [engine/002](stories/002-artifact-types-table.md), [engine/003](stories/003-init-scaffolding.md), [engine/004](stories/004-cli-legacy-fallback.md), [engine/005](stories/005-front-matter-grammar.md), [engine/006](stories/006-bolt-types-contract.md) | W1 |
| [003-engine-authorship-rule](bolts/003-engine-authorship-rule/bolt.md) | simple-bolt | [engine/007](stories/007-bank-is-documentation.md), [engine/008](stories/008-bank-write-blocker.md), [engine/009](stories/009-skills-return-bank-content.md) | W1 |
| [004-engine-events](bolts/004-engine-events/bolt.md) | construction-bolt | [engine/010](stories/010-execution-plans-home.md), [engine/011](stories/011-typed-event-records.md) | W2 |
| [005-engine-planning-stages](bolts/005-engine-planning-stages/bolt.md) | construction-bolt | [engine/012](stories/012-planning-stages.md), [engine/013](stories/013-bank-templates.md), [engine/014](stories/014-spike-bolt-type.md) | W2 |
| [006-engine-build-stages](bolts/006-engine-build-stages/bolt.md) | construction-bolt | [engine/015](stories/015-bolt-types-in-build-lifecycles.md) | W3 |
| [007-engine-handoff-hook](bolts/007-engine-handoff-hook/bolt.md) | simple-bolt | [engine/016](stories/016-hook-reads-execution-plans.md), [engine/017](stories/017-hook-fallback-warning.md) | W3 |
| [009-engine-rename](bolts/009-engine-rename/bolt.md) | construction-bolt | [engine/018](stories/018-engine-plugin-identity.md), [engine/019](stories/019-engine-prefixes-and-init.md), [engine/020](stories/020-keepalive-commands.md) | W4 |
| [011-engine-path-sweep](bolts/011-engine-path-sweep/bolt.md) | simple-bolt | [engine/021](stories/021-stale-names-check.md) | W6 |
| [012-engine-migrate-plan](bolts/012-engine-migrate-plan/bolt.md) | construction-bolt | [engine/022](stories/022-migrate-artifacts.md) | W3 (fallback W5) |
| [013-engine-notices](bolts/013-engine-notices/bolt.md) | simple-bolt | [engine/025](stories/025-specsmd-attribution.md) | W2 |
| [014-engine-migrate-settings](bolts/014-engine-migrate-settings/bolt.md) | construction-bolt | [engine/023](stories/023-migrate-memory-and-settings.md), [engine/024](stories/024-migrate-skill-and-detect.md), [engine/031](stories/031-migrate-config-moves.md) | W5 |
| [015-engine-forgeline-root](bolts/015-engine-forgeline-root/bolt.md) | construction-bolt | [engine/026](stories/026-forgeline-root-design.md), [engine/027](stories/027-config-path-sweep.md), [engine/028](stories/028-config-paths-map.md), [engine/029](stories/029-config-readers-fallback.md), [engine/030](stories/030-init-and-tests.md), [lens/007](../lens/stories/007-lens-config-reader.md) | W3 (merges last) |

Bolt 012 and bolt 014 are the two halves of the former bolt 012 (split by the product-owner, step 1.1.29; ids settled in step 1.1.30.2). Bolt 012 runs in W3 on a non-blocking rule, approved at G3, 2026-11-14 (D79).

Bolt 015 was added after feature 8 (D53, D66, step 1.1.32): the `.forgeline/` root, with the sub-layout of D70. It is placed in W3 and merges last (D68). Its story lens/007 sits in the lens unit's stories folder: cross-unit exception (FR-18), the engine bolt carries the lens reader story and the lens unit owns AC-18.4[lens]. The `.ai-dlc/*` migrate move is story engine/031 in bolt 014 (D72).
