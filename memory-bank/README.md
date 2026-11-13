# memory-bank

**Planned:** the `memory-bank/` layout is part of intent 001 (release `1.0.0-preview2`), which is still being planned. No tooling creates or checks it yet. This folder currently holds only the preview2 planning, written by hand ahead of the tooling.

## What it will hold

- `product/` — product knowledge: the unit registry (`product/units.md`), intents (`product/intents/<id>/` with `requirements.md`, `acceptance-criteria.md`, `inception-log.md` and `units.md`, and per-unit folders `units/<unit>/` with a `unit-brief.md`), specs (`product/specs/`), decisions (`product/decisions/`), architecture narratives (`product/narratives/`), and other product artifacts as spec 001 decides (§2).
- `project/` — project knowledge: the backlog (`project/backlog.md`, which already holds the `1.0.0-preview2` items), task plans (`project/plans/`), and other project artifacts as spec 001 decides (§2).

Each artifact type will have one home. Stage agents own the content; only `documentation-writer` writes files here, and `brutal-critique` gates them.

## What stays elsewhere

- `execution-plans/` holds run records: plans, handoffs, hand-backs, run state and decisions. This run's records are in `execution-plans/AI-DLC-20261113-preview2-specsmd/`.
- Reader-facing documents (README files, `docs/plugins.md`, user guides, release notes) stay in `docs/`.
- Items ITEM-001 to ITEM-110 stay in `docs/backlog/backlog.md` until ITEM-121 moves them.

## Current contents

- [Intent 001 — preview2](product/intents/001-preview2-specsmd/requirements.md) (planned; G1 approved; name amendments approved at G2)
- [Acceptance criteria](product/intents/001-preview2-specsmd/acceptance-criteria.md) (draft, planned)
- [Inception log](product/intents/001-preview2-specsmd/inception-log.md)
- [Backlog — 1.0.0-preview2](project/backlog.md) (planned)
- [Unit registry](product/units.md) (planned, G2 pending)
- [Intent 001 — unit decomposition](product/intents/001-preview2-specsmd/units.md) (draft, planned)
- Unit briefs: [engine](product/intents/001-preview2-specsmd/units/engine/unit-brief.md), [lens](product/intents/001-preview2-specsmd/units/lens/unit-brief.md) (draft, planned)
- Decisions, proposed at G2: [ADR-0011 records are events](product/decisions/ADR-0011-records-are-events.md), [ADR-0012 bolt types are stage subsets](product/decisions/ADR-0012-bolt-types-are-stage-subsets.md), [ADR-0013 one home per artifact type](product/decisions/ADR-0013-one-home-per-artifact-type.md), [ADR-0014 single writer of the memory bank](product/decisions/ADR-0014-single-writer-of-memory-bank.md), [ADR-0015 rename to engine and forgeline](product/decisions/ADR-0015-rename-to-engine-and-forgeline.md), [ADR-0016 stable units](product/decisions/ADR-0016-stable-units.md)
- [Spec 001 — preview2](product/specs/001-preview2-specsmd.spec.md) (draft, planned, G2 pending)
- [Architecture narrative — preview2](product/narratives/preview2-specsmd.md) (planned, G2 pending)
- [Task plan — intent 001, draft bolt index](project/plans/001-preview2-specsmd.tasks.md) (draft, planned; finalised at G3)
