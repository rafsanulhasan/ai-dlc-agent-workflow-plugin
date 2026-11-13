# memory-bank

**Planned:** the `memory-bank/` layout is part of intent 001 (release `1.0.0-preview2`), which is still being planned. No tooling creates or checks it yet. This folder currently holds only the preview2 planning, written by hand ahead of the tooling.

## What it will hold

- `product/` — product knowledge: intents (`product/intents/<id>/` with `requirements.md`, `acceptance-criteria.md` and `inception-log.md`), and other product artifacts as FR-1 and unit 1 decide.
- `project/` — project knowledge: the backlog (`project/backlog.md`, which already holds the `1.0.0-preview2` items), and other project artifacts as FR-1 and unit 1 decide.

Each artifact type will have one home. Stage agents own the content; only `documentation-writer` writes files here, and `brutal-critique` gates them.

## What stays elsewhere

- `execution-plans/` holds run records: plans, handoffs, hand-backs, run state and decisions. This run's records are in `execution-plans/AI-DLC-20261113-preview2-specsmd/`.
- Reader-facing documents (README files, `docs/plugins.md`, user guides, release notes) stay in `docs/`.
- Items ITEM-001 to ITEM-110 stay in `docs/backlog/backlog.md` until unit 11 moves them.

## Current contents

- [Intent 001 — preview2](product/intents/001-preview2-specsmd/requirements.md) (planned, G1 pending)
- [Acceptance criteria](product/intents/001-preview2-specsmd/acceptance-criteria.md) (draft, planned)
- [Inception log](product/intents/001-preview2-specsmd/inception-log.md)
- [Backlog — 1.0.0-preview2](project/backlog.md) (planned, G1 pending)
