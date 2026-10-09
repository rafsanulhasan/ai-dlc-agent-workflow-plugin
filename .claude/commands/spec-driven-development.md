---
description: Manages the full lifecycle of a feature specification — from collaborative drafting to enforcement during implementation and testing.
---

Invoked by the `requirement-analyst` agent to drive spec-driven development. The skill shepherds a feature specification through three phases:

1. **Drafting** — `requirement-analyst` produces an initial spec from elicited requirements, then consults `software-architect` (architectural alignment, feasibility, component boundaries) and `system-engineer` (SOLID/DRY/YAGNI, data shape conformance) in iterative review rounds until both sign off.

2. **Finalization** — writes the approved spec to `docs/specs/<feature-slug>.spec.md` with required sections: Overview, Acceptance Criteria, Component Boundaries, Data Shapes (`{ data, error }` envelope), Out of Scope, and Open Questions.

3. **Enforcement Handoff** — emits a summary block listing the spec path and all AC IDs that `software-engineer` and `sqa-engineer` must reference. No implementation or test may be written without tracing to a numbered AC. Any deviation requires updating the spec via this skill before proceeding.
