---
work-item: AAW-20261021-model-policy
status: done
lifecycle: AAW
current-stage: closed
owner: orchestrator
session: 2762ce0e-e70f-4c77-9cc4-2048fa5ab363
branch: feat/ai-dlc-lens
commit: 0ed5475
updated: 2026-10-21 00:00
---

# Run: AAW-20261021-model-policy — model-selection policy for new agents

## Request
"suggest models for each agent so that we can minimize the costing" (second item of the plan)

## Clarified intent
`skills/agent-management/SKILL.md:42` gives the default model as the pinned id `claude-sonnet-4-6`. Change it to the `sonnet` alias, consistent with `plugin-management/SKILL.md:52`, and add a short model-selection tier rule next to it. The tiers: opus for rarely spawned agents whose errors propagate downstream; sonnet for build, test, review, critique and planning; haiku for read-heavy lookup that is spawned often and checked by others; fable never as a default. Done = brutal-critique returns PASS and the build `--check` passes. agent-management is a skill agent-manager owns, so a fresh agent-manager makes this change.

## Routing Plan
AAW, a fresh agent-manager → brutal-critique (docs). The human confirmed the plan on 2026-10-21. Sibling item: `docs/handoffs/AAW-20261021-agent-models/run.md`.

## Stages
| Stage | Owner | Status | Hand-back | Handoff record | Updated |
|---|---|---|---|---|---|
| change | agent-manager | done | `01-agent-manager-handback.md` | — | 2026-10-21 |
| critique | brutal-critique | done (REVISE) | `02-brutal-critique-handback.md` | — | 2026-10-21 |
| change r2 | agent-manager | done | `04-agent-manager-handback.md` | — | 2026-10-21|
| critique r2 | brutal-critique | done (PASS + Major 1) | `05-brutal-critique-handback.md` | — | 2026-10-21 |
| change r3 | agent-manager | done | `06-agent-manager-handback.md` | — | 2026-10-21 |
| critique r3 | brutal-critique | done (PASS) | `07-brutal-critique-handback.md` | — | 2026-10-21 |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| critique → change | round 1 / budget | REVISE, all findings sent to a fresh agent-manager | orchestrator | 2026-10-21 |
| critique → change | round 2 / 3 | PASS with Major 1, sent back (a Major on a PASS starts a round) | orchestrator | 2026-10-21 |
| critique r3 | round 3 / 3 | PASS, no findings; closed | orchestrator | 2026-10-21 |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|

## Next action
None. The run is closed. Minor listed and not fixed: skill-management:35 says "other harnesses" in general; the critic accepted it as written.
