---
id: 021-stale-names-check
unit: engine
intent: 001-preview2-specsmd
status: ready
priority: must
bolt: 011-engine-path-sweep
created: 2026-11-14
---

# engine/021 — One test that fails on any legacy path or old name

**Planned:** nothing here is built yet. The story belongs to [bolt 011-engine-path-sweep](../bolts/011-engine-path-sweep/bolt.md), which has not started (G3 approved, 2026-11-14, D79).

## Story

As a maintainer, I want one test that fails on any legacy path or old name outside an explicit allowlist, so that the rename and the move stay complete.

## Acceptance criteria

- AC-10.1
- AC-10.2
- AC-10.3
- AC-10.4
- AC-17.3
- AC-17.4
- AC-16.4[011]
- AC-18.8 (G1 amendment D69, approved at G3, 2026-11-14 (D80))

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- It adds `tests/stale-names.test.mjs` with a planted-pattern test, and `tools/stale-names.allowlist.json`. The test accepts an allowlist path that does not exist yet (the rename pages ITEM-123 writes later) and allowlists its own regex strings.
- It runs after ITEM-121 (R-1) and requires bolts 009, 010, 012, 014 and 015: its search scope includes `docs/` and `README.md`, which hold old names until the dogfood migration has moved the history.
- A hit in a lens-owned path becomes a fix round of bolt 010.
- `docs/follow-ups.md` is a project record. ITEM-121 moves it to `memory-bank/project/follow-ups.md` with `git mv` and `documentation-writer` updates its stale paths in the same stage, so it needs no allowlist entry and is out of this bolt's scope (R-8; product-owner, 1.1.25 and 1.1.25.1, D43).
- Expected allowlist entries (decided when the bolt runs): migration code and fixtures, `tests/fixtures/grammar/**`, the hook and lens fallback tests, the files of their own that end at 1.0.0 (`runs-root.ts`, `engine-names.ts`), the `validate` detect code, and the rename pages.
- AC-18.8: the check also flags each old `.ai-dlc/` path that is a `CONFIG_PATHS` source and `memory-bank/` or `execution-plans/` not preceded by `.forgeline/`, with the same search places and allowlist (bolt 015's sweep supplies the file list).
