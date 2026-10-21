---
run: AAW-20261021-agent-models
work-item: none
status: done
lifecycle: AAW
mode: subagent
current-stage: closed
owner: orchestrator
session: 2762ce0e-e70f-4c77-9cc4-2048fa5ab363
branch: feat/ai-dlc-lens
commit: 0ed5475
last-record: 2.l1-brutal-critique-to-orchestrator.handback.md
updated: 2026-10-21 00:00
---

# Run: AAW-20261021-agent-models — cheaper per-agent models

## Request
"suggest models for each agent so that we can minimize the costing"

## Clarified intent
Apply the approved plan (`C:\Users\rafsa\.claude\plans\suggest-models-for-wach-declarative-iverson.md`): `model:` frontmatter changes product-owner, product-manager and system-engineer → sonnet; research-assistant and presentation-manager → haiku. Add the research-assistant escalation rule to `skills/agent-invocation/SKILL.md`: Haiku by default; pass `model: "sonnet"` when the input is above about 80K tokens or needs deep multi-source synthesis; otherwise split into chunked parallel Haiku spawns. Done = the files are changed, the build `--check` passes, both validates pass, and brutal-critique returns PASS.

## Routing Plan
AAW, agent-manager → brutal-critique (docs). The human confirmed the plan on 2026-10-21. Sibling item: `docs/handoffs/AAW-20261021-model-policy/run.md`.

## Stages
| Step | Stage | Owner | Status | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|
| 1 | change | agent-manager | done | not recorded (pre-convention) | `1-agent-manager-to-orchestrator.handback.md` | 2026-10-21 |
| 2 | critique | brutal-critique | done (REVISE) | not recorded (pre-convention) | `2-brutal-critique-to-orchestrator.handback.md` | 2026-10-21 |
| 1.l1 | change r2 | agent-manager | done | not recorded (pre-convention) | `1.l1-agent-manager-to-orchestrator.handback.md` | 2026-10-21 |
| 2.l1 | critique r2 | brutal-critique | done (PASS) | not recorded (pre-convention) | `2.l1-brutal-critique-to-orchestrator.handback.md` | 2026-10-21 |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| critique → change | round 1 / budget | REVISE, all findings sent to a fresh agent-manager | orchestrator | 2026-10-21 |
| critique r2 | round 2 / 3 | PASS, no Blocker or Major; closed | orchestrator | 2026-10-21 |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|

## Next action
None. The run is closed. Minors listed in the closing report and not fixed: (1) agent-invocation:36 could say "per *Model per spawn*" instead of "pass model: sonnet"; (2) "more than about 10 files" could drop "about".
