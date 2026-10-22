---
run: AAW-20261022-fold-cache-keepalive
work-item: none
status: active
lifecycle: AAW
mode: subagent
current-stage: change
owner: orchestrator
session: 58660ab5-ecd5-4db7-bc56-f712185e6ceb
branch: fix/auto-handoff-chain
commit: a802138138b74fad182ce49f63caa5db58a536d1
last-record: 3-research-assistant-to-orchestrator.handback.md
updated: 2026-10-22 20:55
---

# Run: AAW-20261022-fold-cache-keepalive — fold cache-keepalive into ai-dlc, cache-aware handoff, keep-alive rework

## Request
"Bring the mod as a part of the ai-dlc plugin, and implement the deep integration to reuse keepalive's prompt-cache keep-alive behaviour in the auto-handoff module, so one module manages context and cache, and drop the separate mod dependency — so that keepalive's cache can be re-read at the start of the session that has been handed off using the auto-handoff mod." (human, 2026-10-22, during `AAW-20261022-auto-handoff-chain`)

Additions from the human on 2026-10-22, in this session:
- "run this on this branch, no need to create another branch"
- "I want the auto-handoff mod pickup the cache during handing off to the new session."
- Spend limit: "if a session's work is finished it stops keeping the cache warm for that session."
- Cache lifetimes: "treat the 5 min cache and 1 hour cache separately … for 5 min cache … a different delay (3 mins) and a max settings … two status lines for the two types of cache."
- Settings: "all the settings it uses need to be configurable": settings.local.json env > settings.json env > `.ai-dlc/cache-keepalive.json` > defaults; ignore any invalid value.
- Commands: "all the command needs a ai-dlc: prefix so that it does not clash with other plugin".
- 5-minute defaults: "ping 3m, upto 1 hr".

## Clarified intent
The approved plan is [plan.md](plan.md), a copy of the plan the human approved on 2026-10-22. It holds the full scope, the precedence, the env var table, the command prefix changes and the verification list.

Human decisions (AskUserQuestion, 2026-10-22):
- **Direction:** do both. Make the handoff cache-aware, and fold keep-alive into ai-dlc, dropping the mod dependency.
- **Spend limit:** keep both stop rules. The work-done stop is added, and the spend limit becomes optional: `AI_DLC_KEEPALIVE_BUDGET_MULTIPLIER=0` turns it off.
- **Settings levels, highest first:**
  1. the `/ai-dlc:keepalive` override
  2. the env of settings.local.json
  3. the env of settings.json
  4. `.ai-dlc/cache-keepalive.json`
  5. `/config` userConfig
  6. the defaults

  The process env is not read.
- **5-minute track:** a ping every 3 minutes, for up to 1 hour.
- **Command prefix:** a command registered by a hooks module is bare (research step 3). So: name it `ai-dlc:keepalive` if the API accepts that; otherwise use a plugin skill `/ai-dlc:keepalive`; otherwise ask the human. A bare `/keepalive` never ships.

The human asked to stop after the run state is committed. The change stage is not started.

## Routing Plan
Agent Artifact (hooks module, manifests, marketplace, CI, init skill) → AAW. Confirmed by the human on 2026-10-22, on branch `fix/auto-handoff-chain`, with no new branch. No PM consultation; no SDLC chain.

The optional pre-change measurement (`claude -p "hello" --output-format json`, the `usage.cache_creation` split) is left to the human. After the change, the seed-turn log measures it on its own.

## Stages
| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|
| 1.1 | research: status line meaning | research-assistant | subagent | done | `1.1-orchestrator-to-research-assistant.handoff.md` | `1.1-research-assistant-to-orchestrator.handback.md` | 2026-10-22 20:20 |
| 1.2 | research: cache reuse across the handoff | research-assistant | subagent | done | `1.2-orchestrator-to-research-assistant.handoff.md` | `1.2-research-assistant-to-orchestrator.handback.md` | 2026-10-22 20:22 |
| 2 | research: every keep-alive setting | research-assistant | subagent | done | `2-orchestrator-to-research-assistant.handoff.md` | `2-research-assistant-to-orchestrator.handback.md` | 2026-10-22 20:35 |
| 3 | research: commands and namespacing | research-assistant | subagent | done | `3-orchestrator-to-research-assistant.handoff.md` | `3-research-assistant-to-orchestrator.handback.md` | 2026-10-22 20:48 |
| 4 | change | agent-manager (fresh) | subagent | pending | — | — | 2026-10-22 20:55 |
| 5.1 / 5.2 | critique (docs) · test (code) | brutal-critique · sqa-engineer | subagent | pending | — | — | 2026-10-22 20:55 |
| 6.1 / 6.2 | code-review (standards, spec) | code-reviewer | subagent | pending | — | — | 2026-10-22 20:55 |

The research handoff records were written after the spawns, because those spawns ran in plan mode. Each research hand-back was verified: its cited source paths exist in the repository (`plugins/claude-mods/cache-keepalive/`, `plugins/claude/ai-dlc/hooks/auto-handoff/`).

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| AAW/critique (brutal-critique → change) | 2 rounds / 1 failure (source `loop`, from `rounds --json`) | recorded at run start | orchestrator | 2026-10-22 |
| AAW/test (sqa-engineer → change) | 2 rounds / 1 failure (source `loop`) | recorded at run start | orchestrator | 2026-10-22 |
| AAW/code-review (code-reviewer → change) | 2 rounds / 1 failure (source `loop`) | recorded at run start | orchestrator | 2026-10-22 |
| gate-critique | 2 / 1 (source `default`) | recorded at run start | orchestrator | 2026-10-22 |
| Workflow validate | `node .ai-dlc/workflow.mjs validate` | valid | orchestrator | 2026-10-22 |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|
| 1 | orchestrator → human | Confirm the Routing Plan and who runs the measurement | 1 | closed: confirmed on this branch; measurement optional, left to the human |
| 2 | orchestrator → human | Direction: cache-aware handoff, fold keep-alive, or both | 1 | closed: both |
| 3 | orchestrator → human | Spend limit: replace or keep both | 2 | closed: keep both; the budget is optional |
| 4 | orchestrator → human | Where `/keepalive` and `/config` sit in the precedence | 1 | closed: command on top, `/config` just above the defaults |

## Next action
Write `4-orchestrator-to-agent-manager.handoff.md` and spawn a **fresh** `ai-dlc:agent-manager`. Its brief is [plan.md](plan.md), the change scope, command prefix changes, precedence and env var table, with the research hand-backs 1.1, 1.2, 2 and 3 as inputs. Ask it for a hand-back listing the changed paths, each marked code or docs, the intent, and the checks it ran.

When resuming:
1. Check that `commit` is an ancestor of HEAD.
2. Run `node .ai-dlc/workflow.mjs validate` and `rounds --json` again.
3. Confirm that no `4-*` record exists yet.
