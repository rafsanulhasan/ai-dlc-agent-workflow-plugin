---
intent: 001-preview2-specsmd
status: ready
created: 2026-11-13
updated: 2026-11-14
---

# Unit decomposition — intent 001-preview2-specsmd

**Planned:** this decomposition was proposed by the software-architect (steps 1.1.14 and 1.1.20) and approved at G2 (D38; status `ready`, shown as *planned* because nothing is built). Three points were decided on the way: the unit model, stable unit names (D27); the unit names `engine` and `lens` (D34, following the plugin names of D31 and D32); and the keep-alive toggle (D28). The registry is [../../units.md](../../units.md).

## Units this intent touches

| Unit | Brief | Role |
|---|---|---|
| `engine` | [unit-brief.md](units/engine/unit-brief.md) | Upstream. Owns the contract (layout, event grammar, `workflow.json`, migration) and the team, including keep-alive and auto-handoff. |
| `lens` | [unit-brief.md](units/lens/unit-brief.md) | Consumer. Reads the contract and shows runs live; Claude Code only. |

## Dependency

`lens` depends on `engine`, never the reverse in code. The lens needs the engine's contract (paths and record grammar), the shared grammar vectors, the rename constants and the result of spike bolt 001. The one reverse reference is documentation only: the engine skill `cache-keepalive-lens` names a lens setting in its text (D28).

## Assignment of functional requirements

Requirements are in [requirements.md](requirements.md).

| FR | Engine | Lens |
|---|---|---|
| FR-1 to FR-8 | all | none |
| FR-11, FR-12 | all | none |
| FR-9 hooks and lens read the new paths | the auto-handoff hook (`hooks/auto-handoff`) | the lens readers (resolver, record parsing, run detection) |
| FR-10 no stale `docs/...` references | plugin prose, templates, rules, Copilot build | the lens's own strings and notices |
| FR-15 fallback | `workflow.mjs` and the hook (AC-15.x engine side) | the lens notices (AC-15.x lens side) |
| FR-16 Copilot parity | the build and `--check` (the lens is Claude-only and never projected) | none |
| FR-17 rename | AC-17.1 to AC-17.10, AC-17.12, AC-17.14 | AC-17.11, AC-17.13 (split: the keep-alive skill is in bolt 009, the rest in bolt 010), and the lens side of AC-17.5 |
| FR-18 `.forgeline/` root | the sweep, `CONFIG_PATHS`, the engine readers and writers, `init`, `migrate` and the workflow gate (AC-18.1 to AC-18.3, AC-18.4[engine], AC-18.5 to AC-18.12) | the lens readers (AC-18.4[lens]) |
| FR-13 brand-name research (P3, non-gating) and FR-14 release | intent-level work | intent-level work |

### Split rule for FR-9, FR-10, FR-15, FR-16 and FR-17

Where one requirement spans both code bases, it is split **by file ownership**: the unit that owns the file (the registry's code paths) owns the acceptance criterion that checks that file. A criterion that checks a contract both units must honour (a shared grammar, a shared constant) is owned by the engine, and the lens's bolt lists the engine bolt it requires.

**Cross-unit exception (FR-18).** Story lens/007 reads lens-owned files, but it is built inside the engine bolt 015, because bolt 010 requires 015 and a split would be circular. The engine bolt carries the lens reader story, and the lens unit owns AC-18.4[lens].

## Intent-level work

Work that belongs to no single unit and runs after the unit bolts: ITEM-121 (dogfood migration of this repository's own history, an agent-artifact run, because `.claude/settings*.json` are harness files), ITEM-122 (integration and regression, TLC), ITEM-123 (docs and release notes, including the upgrade guide and its data-loss warning, D23), ITEM-124 (release). Not scheduled in preview2: ITEM-120 (brand-name research, P3, non-gating) and ITEM-125 (remove the fallback in 1.0.0).

## Bolts

The bolt files exist, with status `ready` (planned; G3 approved, 2026-11-14, D79): 15 bolts and 38 stories under each unit's `bolts/` and `stories/` folders. The engine has 13 bolts (001 to 007, 009, 011 to 015) and 31 stories; the lens has 2 bolts (008 and 010) and 7 stories (`lens/007` belongs to the engine bolt 015, the `.forgeline/` root, added after feature 8). The bolt index, the waves and the schedule are in [the task plan](../../../project/plans/001-preview2-specsmd.tasks.md); each unit's list is in its brief: [engine](units/engine/unit-brief.md), [lens](units/lens/unit-brief.md).
