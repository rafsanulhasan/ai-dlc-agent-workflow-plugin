---
work-item: RES-20261020-ai-dlc-mods
status: active
lifecycle: AI-DLC (research done; breakdown next)
current-stage: breakdown
owner: orchestrator
session: vscode 2026-10-20
branch: feat/ai-dlc-lens
updated: 2026-10-20
---

# Run: RES-20261020-ai-dlc-mods — research and packaging of AI-DLC mods (R1–R17)

## Request
"I want to build a number of mods for the current ai-dlc plugin (see https://claude-mods.com/) … for both VS Code and CLI." The request lists 17 requirements and 41 mods. "Classify each requirement and map with given links, then run multiple parallel research subagents … and give me a combined report with a separate research assistant for the aggregated report." "Keep the file in the repo."

## Clarified intent
- Research and plan only for now. The build is routed later as separate work items.
- Decisions the human made on 2026-10-20 (see `00-approved-plan.md`, *Human decisions*):
  1. R1 trigger: the context window **or** the 5-hour window, whichever reaches 70% first.
  2. R2: stop, write the handoff, and print the `copilot`/`claude` command. No automatic account rotation.
  3. Packaging: ai-dlc core (AAW) plus one Claude-only mods plugin, made by expanding the FEAT-20261020-ai-dlc-lens run.
  4. Release: **1.0.0 ships the mods for Claude**. Mods that run through hooks are also integrated for Copilot.

## Routing Plan
Type: Feature (research spike plus packaging). Research was done by 10 `research-assistant` agents run in parallel (clusters A–J) and one aggregator. Next: product-manager produces the binding work breakdown, then product-owner decides scope (G1 items are listed in `00-approved-plan.md`). The Routing Plan is presented to the human after that.

## Stages
| Stage | Owner | Status | Hand-back | Handoff record | Updated |
|---|---|---|---|---|---|
| classify + map R1–R17 to mods | orchestrator | done | — | `00-approved-plan.md` | 2026-10-20 |
| research A–J (×10, parallel) | research-assistant | done | `01`–`10-research-assistant-handback.md` | — | 2026-10-20 |
| aggregate report | research-assistant | done | `11-research-assistant-handback.md` | — | 2026-10-20 |
| plan approval + decisions | human | done | — | `00-approved-plan.md` | 2026-10-20 |
| breakdown (work items, waves, merge with FEAT-20261020-ai-dlc-lens) | product-manager | pending | — | — | — |
| scope / G1 open items | product-owner | pending | — | — | — |
| routing plan confirmation | human | pending | — | — | — |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| Research plan | human | approved | human | 2026-10-20 |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|
| 1 | orchestrator → product-owner | What does "context waste" mean (R5)? Review per edit or per stage? Do Bash changes count (R6)? Is a GitHub issue/PR mirror in scope (R9)? Vendor or fork blast-radius? How should build-copilot handle several plugins (W0)? | 0 | open |

## Next action
Spawn product-manager with a work-breakdown brief built from `00-approved-plan.md` (requirements table, suggested waves W0–W4, human decisions) and `11-research-assistant-handback.md`. Ask it to say how the items fold into FEAT-20261020-ai-dlc-lens (that run is paused; its own `run.md` still lists its WI-0 research as pending, and research cluster D already answered its Q1). Then consult product-owner on the open clarification above.
