# ADR-0016: Units are stable product slices with intent-scoped folders

- **Status:** Accepted (G2 approved, D38). The unit model is decided by the human (D27). Planned: nothing is built.
- **Date:** 2026-11-13
- **Deciders:** software-architect (1.1.14, 1.1.20), human (D14, D18, D27, D31, D32, D34).

## Context

specsmd numbers units per intent (`{UUU}-{name}`). The human named two lasting units (D14, first `ai-dlc-engine` and `ai-dlc-lens`), that every future intent touches; the slugs follow the plugin names, `engine` and `lens` (D31, D32), and the human confirmed them as the unit names (D34).

## Decision

Unit slugs come from the registry [`memory-bank/product/units.md`](../../units.md) (slug, purpose, owned code paths) and carry no number. Each intent has a folder for each unit it touches: `intents/{intent}/units/{unit-slug}/`, holding `unit-brief.md`, `stories/` and `bolts/`. Bolt ids are global: `{BBB}-{unit-slug}-{bolt-slug}`.

## Consequences

- The same unit name appears across intents, and history is read by slug.
- Each intent holds only its own work.
- A new unit is one new registry entry.

## Alternatives rejected

- specsmd's per-intent numbered units: a new name for the same slice in every intent.
- A product-level `product/units/<unit>/` holding every intent's work: mixes intents and grows without bound.
