# ADR-0003: The taxonomy declaration lives in its own file, `.ai-dlc/taxonomy.json`

**Date**: 2026-10-24
**Status**: Proposed (awaiting G2; brief §8 Q18 left the choice to the architect)
**Deciders**: software-architect; the human at G2

## Context

A repository may declare its modules, submodules, features and integrations once, with stable ids. Tags on run states, backlog items, stories and tasks are then validated against that declaration (root 18). The human left its home open between two options: a `taxonomy` section of `.ai-dlc/workflow.json`, or a separate `.ai-dlc/taxonomy.json` (00c root 18; 14.1.13 §2).

Several facts bear on the choice. `workflow.json` describes lifecycles and routing. Under `AGENTS.md` it is agent-artifact work: only `agent-manager` changes it, and every change runs an AAW review. Its schema is closed. `merge` adds the template's keys during **upgrade**. The taxonomy changes when the product changes, for example when a module is added or a feature is named. Those are decisions for the product owner and product manager, not for agent-manager.

## Decision

We will keep the declaration in an optional `.ai-dlc/taxonomy.json`, with its own schema (`taxonomy.schema.json`, shipped in the `workflow` skill's templates). `node .ai-dlc/workflow.mjs validate` validates it whenever it exists.

- **No file, no change.** When the file is missing, validation is unchanged. The plugin never ships a declaration and never ships this repository's names.
- **Who changes it.** `product-manager` maintains the file through `product-planning`, on `product-owner`'s decisions. It is product data, not an agent artifact, so it is not added to the agent-artifact table.
- **Validation.** `validate` checks the file, so the Stop gate covers it whenever `.ai-dlc/` changes. The checks of tagged artefacts run under `validate --artefacts`, in CI and by `product-manager`. The gate does not run them, because it fires only on `.ai-dlc/` changes and would block unrelated work.

## Alternatives considered

- **A `taxonomy` section in `workflow.json`.** Rejected. Adding a module would become an agent-artifact change: a freshly spawned agent-manager, an AAW run and critique, all for a product decision. `merge` would also bring the template's (empty) section into every consumer's file on upgrade.
- **Tags only in front matter, with no central list** (14.1.13 option C). Rejected because nothing could reject a typo. The stories require undeclared ids to fail validation (AC-18.3.3).

## Consequences

### Positive
- Product roles change the taxonomy without an AAW run.
- The workflow file stays about the workflow. Upgrading the plugin never touches a repository's taxonomy.

### Negative / Trade-offs
- There is one more file to document, and one more schema in the templates that install and upgrade copy.
- `workflow.mjs` validates a file it does not own conceptually. The validator's scope grows from "the workflow" to "the workflow and the artefacts tagged against the taxonomy".

### Neutral
- `.ai-dlc/taxonomy.json` is committed like the rest of `.ai-dlc/`.

## Compliance checklist

- [x] Affected components:
  - `workflow.mjs` (validate), `taxonomy.schema.json` (new), `workflow/SKILL.md`;
  - `product-planning`, `task-triage`, `handoff`;
  - this repository's `.ai-dlc/taxonomy.json`.
- [x] Related ADRs: ADR-0004.
- [x] `{ data, error }`: not applicable.
- [x] No stack traces exposed.
- [ ] DI registration: not applicable.
- [x] No ADR superseded.
