# ADR-0012: Bolt types are named, skippable stage subsets of existing lifecycles

- **Status:** Accepted (G2 approved, D38). Planned: nothing is built. Decided by the human on the way (D29): the `probe` stage and spike bolt 001 first.
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), system-engineer (1.1.19), human at G2.

## Context

specsmd has bolt types with their own stages. The product owner prefers no new lifecycles (FR-4), and our lifecycles already carry owners, artifacts, loops and gates.

## Decision

The top-level `boltTypes` key of `workflow.json` maps each bolt type to the stages of existing lifecycles that it runs: an array of stage ids, `"*"` for all, or an object with `stages` and an optional `after` override. A type may set `producesCode: false`.

- Stages outside the type are skipped like a stage whose `when` does not hold; the decision is recorded in the handoff and dependents proceed. Order comes from the lifecycle's `after` edges (plus the override for the spike type), not from array order.
- Building stages carry a new flag `building: true` (FDLC `build`, BFLC `fix`, RLC `refactor`, AAWH `change`, AAWP `change`), which makes "the building stage" of the documentation rule machine-readable. A type with `producesCode: false` may not contain one.
- Default types: `construction-bolt`, `simple-bolt` and `spike-bolt` (ASDLC research and probe, then architecture).
- Three new stages, with no new gates: `unit-design` (ASDLC), `bolt-design` (STBLC) and `probe` (ASDLC, owned by `software-engineer`, writes only under `.scratch/`).
- `validate` checks type ids, that the lifecycles and stage ids exist, duplicates, that overrides are inside the subset and acyclic, and the no-building rule for `producesCode: false`.

## Consequences

- No new lifecycles or gates; projects may add their own types.
- The skip rule reuses the existing `when` mechanism.
- A type means something only in the lifecycles it lists.
- `probe` widens ASDLC beyond FR-3, and the human decided it (D29).

## Alternatives rejected

- One lifecycle per bolt type: rejected by the product owner.
- specsmd's domain-driven-design stages: tied to one paradigm; folded into the low-level design stage.
- An ordered-subsequence rule: cannot express research before the recommendation in ASDLC, where `research` and `architecture` both have `after: []`.
- `research-assistant` running the live spike: it has no `Bash` tool.
