---
run: FEAT-20261020-ai-dlc-lens
step: 30
from: orchestrator
to: team (sa, se, po, pm, bc)
kind: handoff (whole-wave: Wave 2 Design, tier 1 roots 16-20)
mode: team
date: 2026-10-24
run-state: run.v3.md
---

# Wave 2 Design, tier 1 (roots 16-20) → G2, then the task plan → G3

## Goal
Turn the G1-approved stories into a frozen spec per root:
- architecture narrative, HLD, ADRs, UML (software-architect);
- low-level design (system-engineer);
- all critiqued, so that G2 can freeze them and pm can write the task plan for G3.

## Team (team mode: SendMessage between teammates; the orchestrator `main` only leads)
| Name | Agent | Does |
|---|---|---|
| `sa` | software-architect | Per root: spec at `docs/specs/<feature-slug>.spec.md`, narrative at `docs/architecture/narratives/<feature-slug>.md`, ADRs in `docs/architecture/decisions/` (only for real decisions: Q18 taxonomy home, Q19d variant routing, the taxonomy and handoff-tree scan, the AAW validator guards), UML in Mermaid. Clarify loop with `po`/`pm` for business intent. Hands off to `se`. |
| `se` | system-engineer | Per root: LLD (modules, functions, seams, test seams, data shapes, the status-line string table for 17), in the spec's LLD section or `docs/specs/<feature-slug>.lld.md`. Loop with `sa`. |
| `po` | product-owner | Answers intent questions (Clarify). Accepts the specs against the stories before G2. |
| `pm` | product-manager | After the specs pass: the task plan `docs/plans/<feature-slug>.tasks.md` per root (or one tier 1 plan), in build order and with merge groups → G3. |
| `bc` | brutal-critique | Critiques every spec, LLD, ADR and plan, and every handoff, PASS / REVISE. Limits 2 rounds / 1 failure per document. |

Rules (as in Wave 1):
- the sender writes the handoff, the receiver writes the hand-back, and the sender verifies;
- records sit under each root's planning sub-root: `<root>.1.<n>-<from>-to-<to>.handoff.md` / `.handback.md`, with critique rounds `.l1.<round>`. For example, the architect's first handoff for root 18 is `18.1.1-software-architect-to-system-engineer.handoff.md`;
- report every record name to `main`;
- load your skills yourself:
  - everyone: `manage-memory` (your id), `handoff`;
  - sa: `architecture-design`, `architecture-narrative`, `write-adr`, `spec-driven-development`;
  - se: `system-design`, `spec-driven-development`;
  - pm: `task-triage`, `product-planning`;
  - po: `product-planning`.
- **Root 19 and the `workflow` skill:** the design only. Build changes to agent-manager's own skills are made later by a fresh agent-manager.
- **No code and no agent-artifact edits.** README changes are *Docs update* requests in your hand-backs.

## Inputs
- **G1-approved, binding:** brief `docs/product/active/brief-tier-1-sprint-1.md` (section 8 defaults approved, Q34 = No, PO decisions approved), and the stories:
  - `docs/product/active/session-continuity-and-cache-visibility/sprint-1/{auto-handoff-session-numbering,keepalive-cache-status}/stories.md`;
  - `docs/product/active/multi-agent-workflow-foundations/sprint-1/{taxonomy,aaw-variants}/stories.md`;
  - `docs/product/active/ai-dlc-lens/sprint-1/diagramming/stories.md`.
- **Breakdown:** `docs/product/active/work-breakdown-tier-1-sprint-1.md` and the `tasks.md` files.
- **Plan:** `00c-approved-plan-2026-10-24.md`.
- **Research:** 14.1.1-14.1.5, 14.1.11-14.1.15, 14.1.17 hand-backs in this folder.
- **G2 spikes**, run by the orchestrator in parallel and sent to you as they land:
  - 17.1.1: can subagent cache usage be observed and pinged from a hook? (ITEM-034, Q34);
  - 20.1.1: can a render replace one fence in an assistant message; resvg-js / MathJax / beautiful-mermaid licences;
  - 17.1.2: price spot-check for AC-17.5.1.
  - Design around them, and mark anything that depends on a spike as conditional.

## Acceptance criteria
1. Every root 16-20 has a spec with an LLD that traces every AC to a design element and a test seam. bc gives PASS (or the stop is recorded).
2. ADRs exist for the real decisions only, each critiqued.
3. `po` accepts the specs against the stories.
4. `pm`'s task plan exists, critiqued, in build order with merge groups.
5. Every inter-agent record is on disk with its sender verification.

## Deliverable
`sa` writes `30-team-to-orchestrator.handback.md` when the specs pass and `po` accepts. Line 1: `handoff 30-orchestrator-to-team.handoff.md: passed|failed — <why>`. Then the artifact paths, record names, bc verdicts, the G2 questions with defaults, and `totals:`. `pm` reports the task plan afterwards for G3. Next hop: G2 (human), then G3 (human), then Wave 3 Build (`run.v4.md`).
