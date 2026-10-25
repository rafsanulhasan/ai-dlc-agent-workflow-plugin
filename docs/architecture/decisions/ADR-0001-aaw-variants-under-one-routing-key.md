# ADR-0001: AAW variants under one routing key, chosen by an executable change-set rule

**Date**: 2026-10-24
**Status**: Proposed (awaiting G2)
**Deciders**: software-architect; the human at G2 (brief §8 Q19d)

## Context

Agent-artifact work (AAW) runs a single lifecycle, which `routing.byType["Agent Artifact"]` names as a string (`"AAW"`). In it, `agent-manager` makes the change and the reviewers follow.

The human decided on two shapes. A harness edit (agent, skill and rule Markdown) runs `product-owner` ↔ `agent-manager` with docs critique. A plugin or mod change also needs design (`software-architect`, `system-engineer`), tests and code review. Neither shape uses `software-engineer` (00c, root 19).

The orchestrator must pick between the two without guessing, in this repository and in consumer repositories alike. The workflow schema is closed, and `merge` never overwrites a value, so changing the shape of the routing value also changes how consumers upgrade. Run folder names start with the lifecycle code, and the lens reads them with `^[a-z][a-z0-9]*-(\d{8})`.

## Decision

We will define two lifecycles, `AAWH` (harness) and `AAWP` (plugin/mod), each tagged with `variant`, and list both under the one key: `routing.byType["Agent Artifact"]: ["AAWH", "AAWP"]`. A new `node .ai-dlc/workflow.mjs variant <path>...` command picks the lifecycle from the change set.

- **The rule.** Any code path (`aaw-review.md` rows 2-3), or any path in `routing.agentArtifact.pluginPaths`, selects `AAWP`. A set made only of docs paths in `harnessPaths` selects `AAWH`. Any other set gives `ask`: the orchestrator asks one question and recommends a variant.
- **Kind first.** A path that sits in a harness folder but is code, such as `.claude/hooks/x.mjs`, is caught by its kind before its folder is looked at. After every `change` stage, the same command runs on the paths that actually changed (ADR-0002).
- **Where it is written.** `aaw-review.md` states the rule once and names the command. `orchestrator.md` and `request-routing` point to it.
- **The list form.** Only `Agent Artifact` may hold a list. The list must contain exactly one `plugin` variant and at most one `harness` variant. A repository may run with only the plugin variant.
- **Codes.** The codes carry no hyphen, so run folder names stay readable by the lens.
- **Legacy files.** A file whose value is the string `"AAW"` fails `validate` with an upgrade message. `/ai-dlc:workflow upgrade` migrates it with consent (`merge --migrate`).

## Alternatives considered

- **One AAW lifecycle with conditional stages** (`when: the change set contains code` on the design stages). Rejected for three reasons. The conditions would be free text that the validator cannot check against a rule. The orchestrator would still need the same change-set rule. And a harness run would carry the dormant design stages and their loops in every `show` and `rounds` row.
- **Two routing keys** (`Agent Artifact (harness)`, `Agent Artifact (plugin)`). Rejected because the request type is the same and classification happens before the change set is known. Choosing a key would push the change-set decision into Step 1 of classification, which belongs to the routing step.
- **Keep the code `AAW` for the plugin variant.** Rejected because `merge` matches stages by id and keeps arrays as they are. It would graft the new stages onto the old AAW and leave two starting stages, giving a silently malformed lifecycle in place of a clear upgrade error.
- **The rule in prose only.** Rejected because the stories require a test per signal (AC-19.2.x, `[NT]`). A rule that exists only in prose cannot be tested and drifts between `orchestrator.md`, `request-routing` and `aaw-review.md`.

## Consequences

### Positive
- Each change runs only the roles it needs, and the choice of variant is deterministic and tested.
- Consumers can tune `harnessPaths` and `pluginPaths` to their own layout without editing agent text.

### Negative / Trade-offs
- `byType` gains a second value shape, which only one key may use. The schema and the validator carry that special case.
- Every consumer file needs a one-time migration, and a customised old `AAW` lifecycle is kept unrouted with a warning, not converted.
- The orchestrator's list of permitted commands grows by one (`variant`). The command reads files only to tell their kind.

### Neutral
- Run folders for agent-artifact work become `AAWH-…` and `AAWP-…`. Existing `AAW-…` folders keep their names.
- Root 23 later applies the per-handoff review to other lifecycles, and this decision does not cover that.

## Compliance checklist

- [x] Affected components: `workflow.mjs`, `workflow.schema.json`, `workflow.json` (template and this repository's copy), `aaw-review.md`, `workflow/SKILL.md`, `orchestrator.md`, `request-routing`, `AGENTS.template.md`.
- [x] Related ADRs: ADR-0002 (guards and handoff review).
- [x] `{ data, error }`: the one JSON response, `variant --json`, uses it.
- [x] No stack traces exposed: CLI errors are single lines.
- [ ] DI registration: not applicable (no runtime components).
- [x] No ADR superseded.
