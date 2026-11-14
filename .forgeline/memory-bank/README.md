# memory-bank

**Planned (the layout for consumer repositories):** the `memory-bank/` layout is part of intent 001 (release `1.0.0-preview2`), which is still being planned, and no tooling creates or checks it for consumer repositories yet. **In progress (this repository's own bank):** this folder holds the preview2 planning, written by hand ahead of the tooling, and this repository's two standards, described below.

## What it will hold

- `product/` — product knowledge: the unit registry (`product/units.md`), intents (`product/intents/<id>/` with `requirements.md`, `acceptance-criteria.md`, `inception-log.md` and `units.md`, and per-unit folders `units/<unit>/` with a `unit-brief.md`, `stories/` and `bolts/<bolt-id>/bolt.md`), specs (`product/specs/`), decisions (`product/architecture/decisions/`), architecture narratives (`product/architecture/narratives/`), and other product artifacts as spec 001 decides (§2). The `architecture/` folder for decisions and narratives is a G2 amendment (D64), pending the human's approval at G3 ([delta r2](product/specs/001-preview2-specsmd.spec.r2-delta.md)); the frozen spec 001 still says `product/decisions/` and `product/narratives/`.
- `project/` — project knowledge: the backlog (`project/backlog.md`, which already holds the `1.0.0-preview2` items), task plans (`project/plans/`), standards (`project/standards/`), and other project artifacts as spec 001 decides (§2).

Each artifact type will have one home. Stage agents own the content; only `documentation-writer` writes files here, and `brutal-critique` gates them. The one exception is `project/standards/`: standards are agent artifacts, written by `agent-manager` ([ADR-0017](product/architecture/decisions/ADR-0017-standards-are-agent-artifacts.md)). That exception is a G2 amendment (D65), pending the human's approval at G3 ([delta r2](product/specs/001-preview2-specsmd.spec.r2-delta.md)).

**In progress (this repository's own bank):** this repository already keeps its own bank under `.forgeline/` (`.forgeline/memory-bank/`, with run records in `.forgeline/execution-plans/`), and its two standards in `project/standards/` are the source of its rules: `node tools/build-standards.mjs` writes each as a `.claude/rules/` file and a `.github/instructions/` twin. The tooling for consumer repositories is not built yet.

## What stays elsewhere

- `execution-plans/` holds run records: plans, handoffs, hand-backs, run state and decisions. In this repository they are in `.forgeline/execution-plans/`, and this run's records are in `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/`. Older runs stay in `docs/handoffs/` until ITEM-121 moves them (D67).
- Reader-facing documents (README files, `docs/plugins.md`, user guides, release notes) stay in `docs/`.
- Items ITEM-001 to ITEM-110 stay in `docs/backlog/backlog.md` until ITEM-121 moves them. New items go to `project/backlog.md` (D58), and the out-of-scope records of rejected feature requests go to `project/out-of-scope/` (D63).

## Current contents

- [Intent 001 — preview2](product/intents/001-preview2-specsmd/requirements.md) (planned; G1 approved; name amendments approved at G2, D38)
- [Acceptance criteria](product/intents/001-preview2-specsmd/acceptance-criteria.md) (draft, planned; G2 approved)
- [Inception log](product/intents/001-preview2-specsmd/inception-log.md)
- [Backlog — 1.0.0-preview2](project/backlog.md) (planned)
- [Unit registry](product/units.md) (planned; G2 approved, D38)
- [Intent 001 — unit decomposition](product/intents/001-preview2-specsmd/units.md) (planned; status `ready`, G2 approved, D38)
- Unit briefs: [engine](product/intents/001-preview2-specsmd/units/engine/unit-brief.md), [lens](product/intents/001-preview2-specsmd/units/lens/unit-brief.md) (planned; status `ready`, G2 approved, D38)
- Decisions, accepted at G2 (D38): [ADR-0011 records are events](product/architecture/decisions/ADR-0011-records-are-events.md), [ADR-0012 bolt types are stage subsets](product/architecture/decisions/ADR-0012-bolt-types-are-stage-subsets.md), [ADR-0013 one home per artifact type](product/architecture/decisions/ADR-0013-one-home-per-artifact-type.md), [ADR-0014 single writer of the memory bank](product/architecture/decisions/ADR-0014-single-writer-of-memory-bank.md), [ADR-0015 rename to engine and forgeline](product/architecture/decisions/ADR-0015-rename-to-engine-and-forgeline.md), [ADR-0016 stable units](product/architecture/decisions/ADR-0016-stable-units.md)
- Decision, in progress: [ADR-0017 standards are agent artifacts](product/architecture/decisions/ADR-0017-standards-are-agent-artifacts.md) (accepted by the human, D57; its G2 amendment of spec 001 and the acceptance criteria, D65, is pending the human's approval at G3)
- [Spec 001 — preview2](product/specs/001-preview2-specsmd.spec.md) (planned; frozen at G2, D38; revision delta r1 pending at G3)
- [Architecture narrative — preview2](product/architecture/narratives/preview2-specsmd.md) (planned; G2 approved, D38)
- [Task plan — intent 001, bolt index](project/plans/001-preview2-specsmd.tasks.md) (planned; G3 pending)
- Stories and bolts: 31 stories under `product/intents/001-preview2-specsmd/units/<unit>/stories/` and 14 bolts under `product/intents/001-preview2-specsmd/units/<unit>/bolts/<bolt-id>/bolt.md`, linked from the unit briefs (draft, planned; G3 pending)
- [Spec 001 — revision delta r1](product/specs/001-preview2-specsmd.spec.r1-delta.md) (planned; G3 pending)
- [Spec 001 — revision delta r2](product/specs/001-preview2-specsmd.spec.r2-delta.md) (in progress; G2 amendment for ADR-0017 and the consumer paths of decisions and narratives, D64, D65; G3 pending)
