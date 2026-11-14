---
id: 030-init-and-tests
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 015-engine-forgeline-root
created: 2026-11-14
---

# engine/030 — `init` writes the new layout, and the tests and this repository follow

**Planned:** nothing here is built yet. The story belongs to [bolt 015-engine-forgeline-root](../bolts/015-engine-forgeline-root/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a new user, I want `init` to create the `.forgeline/` layout, so that a fresh repository never has a `.ai-dlc/` folder; as a maintainer of this repository, I want its installed copies to match the new templates, so that the tests stay green.

## Acceptance criteria

- AC-18.7[layout] (ITEM-127 AC-6; G1 amendment D69, approved at G3, 2026-11-14 (D80))
- AC-16.4[015] (reworded by the G1 amendment D69, approved at G3, 2026-11-14 (D80); ITEM-127 AC-7)
- AC-18.11 (ITEM-127 AC-8)
- AC-18.10[hook and metadata copies] (ITEM-127 AC-11; D71)
- AC-18.12 (ITEM-127 AC-10): the *Docs update* request in the bolt's hand-back

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- `init` writes the `.gitkeep` scaffolding, the `artifacts` block and the settings `env` documentation for the new layout; the generated `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md` templates name `.forgeline/` paths.
- Exact-string assertions in `tests/workflow`, `tests/model-metadata`, `tests/auto-handoff` and `tests/helpers/paths.mjs` use the new paths; fallback vectors exist; the Windows CI leg runs them.
- D71: the bolt refreshes this repository's installed hook and metadata copies from the plugin templates and moves them to their `CONFIG_PATHS` homes, so `tests/model-metadata/` does not fail while the copies differ. The lld lists the files.
