# ADR-0002: AAW guards by role and variant; the handoff review has its own limits

**Date**: 2026-10-24
**Status**: Proposed (awaiting G2)
**Deciders**: software-architect

## Context

Today's validator protects agent-artifact work by shape. The AAW lifecycle must start with `agent-manager`, and it must have `brutal-critique`, `sqa-engineer` and `code-reviewer` stages that loop back to it (`workflow.mjs`, the "Agent Artifact" block; `aaw-review.md`, *What `validate` enforces*). The two variants of ADR-0001 break both assumptions. They start with `product-owner`, and the harness variant has no test or code-review stages.

The human requires two things. `software-engineer` must never take part in AAW. And every hand-off must be reviewed by `brutal-critique`, with limits of its own and no shared budget (00c, root 19; Q19c).

## Decision

We will guard each lifecycle listed under `Agent Artifact` by role, with stricter guards for the plugin variant, and give the per-handoff review its own `rounds` row and its own variables.

The guards:

- **G1.** No `software-engineer` stage.
- **G2.** At least one `agent-manager` stage.
- **G3.** Every starting stage is `product-owner`, `software-architect` or `agent-manager`.
- **G4.** A `brutal-critique` stage loops back to `agent-manager`.
- **G5.** In the plugin variant only, `sqa-engineer` and then `code-reviewer` loop back to `agent-manager`, as today. The plugin variant also has a `software-architect` stage and a `system-engineer` stage before `agent-manager`.
- **G7.** No disabled agent owns a stage of an AAW lifecycle.
- **G6.** The variant tags and the list shape are valid.

The guarantee "code is always tested and reviewed" no longer rests only on the presence of review stages. It rests on two checks. First, the ADR-0001 rule picks the plugin variant for any expected code path. Second, after every `change` stage, the orchestrator runs `variant` on the paths that were actually changed. When an AAWH run changed code, the run stops and the human chooses to continue under AAWP's test and code-review stages.

A top-level `handoffReview` object names the lifecycles it applies to, `maxRounds` and `maxFailures`; the reviewer is always `brutal-critique`. `rounds --json` prints it as the row `handoff-review`, resolved from `AI_DLC_HANDOFF_REVIEW_MAX_ROUNDS` and `AI_DLC_HANDOFF_REVIEW_MAX_FAILURES` with the same precedence and validity rules as every loop. It never reads the `brutal-critique` variables, which `gate-critique` and the AAW critique stages use. Every record is verified by the agent it is addressed to, so in team mode the sender verifies the hand-back. This extends the existing rule "the receiver verifies; the writer never verifies its own record" to hand-backs.

## Alternatives considered

- **Keep "starts with agent-manager", with the PO and SA stages placed after `change`.** Rejected because it contradicts the human's chain, where intent and design come before the build. It would also make design review the work after the change.
- **Require test and code-review stages in the harness variant too, with `when: the change set contains code`.** Rejected because the rule already sends every code path to the plugin variant, so the stages would never run. They would only add `rounds` rows and confuse `show`.
- **The handoff review reuses the `brutal-critique` variables.** Rejected because one variable would then set both the document critique and the handoff review, which is the shared budget the human ruled out (AC-19.5.2).
- **The orchestrator verifies every hand-back in team mode, as it does in subagent mode.** Rejected because the human decided that team mode keeps the orchestrator to leading and keeping the run state (00c defaults; AC-19.4.2). The sender is the hand-back's addressee, and it has the context to check it.

## Consequences

### Positive
- The validator still rejects an AAW lifecycle that would skip critique, testing or code review for code, or that uses `software-engineer`.
- The handoff review's cost can be tuned on its own, per developer, team or CI job.

### Negative / Trade-offs
- The code-review guarantee now spans two mechanisms, the rule and the guards. A repository that edits `harnessPaths` to include a code folder still gets the plugin variant, because the kind check runs first. But a wrong `pluginPaths` list can send a docs-only plugin change to the harness variant. That costs design review, not code review.
- The ENV variable table in `workflow.mjs` gains its first entry keyed by row id instead of by agent.
- The guarantee depends on the orchestrator running the post-change check. `validate` cannot enforce that a run did this. As today with change classification, it rests on the run's records: the run state shows the check's result for each `change` hand-back.

### Neutral
- The `aaw-review.md` sections *What `validate` enforces* and *Rounds* are rewritten for both variants.
- The handoff naming grammar gains the optional `.h<round>` segment.

## Compliance checklist

- [x] Affected components: `workflow.mjs` (guards, `rounds`), `workflow.schema.json`, `workflow.json`, `aaw-review.md`, `handoff/SKILL.md`, `brutal-critique.md`, `tests/workflow/*.test.mjs`.
- [x] Related ADRs: ADR-0001.
- [x] `{ data, error }`: not applicable (`rounds --json` keeps its existing shape).
- [x] No stack traces exposed.
- [ ] DI registration: not applicable.
- [x] No ADR superseded.
