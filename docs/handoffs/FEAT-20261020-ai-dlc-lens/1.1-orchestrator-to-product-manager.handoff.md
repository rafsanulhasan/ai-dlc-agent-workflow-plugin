---
work-item: FEAT-20261020-ai-dlc-lens
lifecycle: AI-DLC
from: orchestrator
to: product-manager
gate: none
verification: passed
date: 2026-10-20
---

> **Superseded on 2026-10-22.** Never sent. The scope was widened (see `00b-approved-plan-2026-10-22.md`); this brief is replaced by `4.1-orchestrator-to-product-manager.handoff.md` and `4.2`–`4.5-orchestrator-to-research-assistant.handoff.md`. Kept unchanged below for the history of the run.


# orchestrator → product-manager: binding work breakdown for the run-state CLI, gate alert and ai-dlc-lens

## Artifacts
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/00-approved-plan.md` — the human-approved plan: mod shortlist, claude-lens comparison, build-vs-buy feasibility, what-if, cost-benefit, SWOT, the human's decisions and the proposed WI-0..WI-7
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.md` — run state
- `docs/backlog/backlog.md` — backlog (template only today)

## Acceptance criteria covered
| AC | Where it is satisfied / tested |
|---|---|
| AC-1 every proposed WI-0..WI-7 is covered, or merged/split with a reason | product-manager's breakdown |
| AC-2 no dependency cycles | product-manager's breakdown |
| AC-3 the 1.0.0 / 1.1.0 cut line is explicit | product-manager's breakdown |
| AC-4 the items are recorded in `docs/backlog/backlog.md` | the backlog |

## Gate evidence
- Build: n/a (planning) · Tests: n/a · Mutation: n/a · Review: n/a
- Gate: Routing Plan · approver human · approved by the human 2026-10-20

## Decisions made in this stage
- Build option **S5**:
  - a portable `runstate` core plus `workflow.mjs runs [--json] [--active]`
  - a gate-alert hook that `init` installs
  - a **separate** `ai-dlc-lens` mod plugin: pane, status line and notify over the core; a per-agent and per-stage token and cost ledger; `/ai-dlc-lens:report`
- Buy C: point to the existing free usage, cache and context mods. Keep claude-lens for D, the history dashboard.
- Release: in 1.0.0 only if it does not delay the release. Otherwise it moves to 1.1.0, and 1.0.0 gets only the "recommended third-party mods" docs page.
- Cost focus: both. A maintainer report comes first; user-facing history and export come later.

## Clarifications
none

## Open questions / risks for the receiver
- WI-0 (research, `02-orchestrator-to-research-assistant.md`) runs in parallel with this breakdown. Its answers may change the scope of the per-agent cost items. For example, if subagent transcripts carry no agent type, the transcript-report variant (B′) is not possible. Flag any item that depends on it.
- The plugin is at 1.0.0-preview1, unreleased. The version sequence is preview2 → 1.0.0 → 1.0.1 → 1.1.0.

## Suggested skills
- `task-triage` — the breakdown, triage states, waves and the backlog record
- `product-planning` — milestone and cut-line decisions

## Instructions for the receiver
Produce the **binding work breakdown** for this work item. Use the plan's proposed WI-0..WI-7 and waves as input, not as the answer.
1. Check for equivalents that are already built or were rejected before: `docs/backlog/out-of-scope/`, and the existing `workflow`, `handoff` and `init` skills under `plugins/claude/ai-dlc/skills/`.
2. Give each work item:
   - an ID (`ITEM-NNN`, the next free number), a title, a type and a priority
   - a milestone, marking which items are 1.0.0 candidates
   - depends-on and a parallel group
   - a triage state
   - a 2–4 line agent-ready brief
3. Give the execution waves.
4. Record the items in `docs/backlog/backlog.md`. Write only that file.
5. Raise real scope or priority conflicts as open questions for the product-owner. Do not decide them yourself.

Constraints:
- The build items touch agent artifacts: the `workflow.mjs` template, the `init` skill, hooks, the new plugin and the marketplace entry. agent-manager implements them, then sqa-engineer and code-reviewer review them.
- Gates G1–G4 are human-approved.
- The detailed G3 task plan comes later. Produce the work-item level only.

Reply as a compressed report of 40 lines or fewer:
- the items table
- the waves
- the open questions
- the `path:line` of `docs/backlog/backlog.md` where the items start

Next hop: the orchestrator routes each item, and the product-owner takes the Plan stage (G1).
