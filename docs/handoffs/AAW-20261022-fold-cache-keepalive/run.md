---
run: AAW-20261022-fold-cache-keepalive
work-item: none
status: active
lifecycle: AAW
mode: subagent
current-stage: measure
owner: orchestrator
session:
branch: fix/auto-handoff-chain
commit: pending
last-record: none
updated: 2026-10-22 16:30
---

# Run: AAW-20261022-fold-cache-keepalive — fold cache-keepalive into the ai-dlc auto-handoff module

## Request
"Bring the mod as a part of the ai-dlc plugin, and implement the deep integration to reuse keepalive's prompt-cache keep-alive behaviour in the auto-handoff module, so one module manages context and cache, and drop the separate mod dependency — so that keepalive's cache can be re-read at the start of the session that has been handed off using the auto-handoff mod." (human, 2026-10-22, during `AAW-20261022-auto-handoff-chain`)

## Clarified intent
- Move the vendored `plugins/claude-mods/cache-keepalive` into `plugins/claude/ai-dlc/hooks/` (keep its MIT `LICENSE`, record changes in `ATTRIBUTION.md`, `THIRD_PARTY_NOTICES.md`), integrated with the auto-handoff module so one module manages context and cache.
- Drop the `cache-keepalive` dependency of `ai-dlc`, its marketplace entry and its CI loop.
- **Measure first** (human decision 2026-10-22): before the change, measure on a real handed-off session how much prompt cache its first request reads (`cache_read_input_tokens`; `claude -p … --output-format json` for `ephemeral_1h_input_tokens` vs `ephemeral_5m_input_tokens`; `/usage` "Prompt cache (main)"). Research says only the shared prefix (system prompt, tools, CLAUDE.md) can be warm after `/clear`, never the old conversation; keep-alive only arms with background tasks; its fork ping may be in the 5-minute bucket, not the 1 h it assumes.
- Done = keep-alive lives in ai-dlc, timers per session and stopped around `/clear`, compaction gated on a pending handoff, settings in ai-dlc (and `.ai-dlc/auto-handoff.json` with the same precedence: settings.local.json env > settings.json env > process env > repo file > `/config` > default), dependency and mod removed, docs honest about what the cache can and cannot reuse, all checks green, AAW reviews clean.

## Routing Plan
Agent Artifact (hooks module, manifests, marketplace, CI, init skill) → AAW. Not yet confirmed: confirm the plan with the human at the start of the new session.
Proposed steps: 1 research-assistant (verify the measurement method; overlap with the paused `FEAT-20261020-ai-dlc-lens` mods-plugin plan and its status line) → human runs or approves the measurement → 2 agent-manager (change) → 3.1 brutal-critique (docs) · 3.2 sqa-engineer (tests) → 4.1 / 4.2 code-reviewer (standards, spec).

## Inputs
- Research: `docs/handoffs/AAW-20261022-auto-handoff-chain/5.2-research-assistant-to-orchestrator.handback.md` — what the mod does, the full wiring list to change, TTL / prefix facts, integration points, recommended design and risks.
- Decisions: `docs/handoffs/AAW-20261022-auto-handoff-chain/run.md` (*Human decisions*), orchestrator memory `project_auto-handoff-decisions.md`.
- Related plan: `.claude/agent-memory/ai-dlc-orchestrator/project_mods-release-scope.md` (1.0.0 ships mods; one Claude-only mods plugin) — check for conflict.

## Stages
| Step | Stage | Owner | Mode | Status | Handoff | Handback | Updated |
|---|---|---|---|---|---|---|---|
| 1 | research (measurement method, lens overlap) | research-assistant | subagent | pending | — | — | 2026-10-22 |
| — | measure cache reads on a seeded session | human | — | pending | — | — | 2026-10-22 |
| 2 | change | agent-manager | subagent | pending | — | — | 2026-10-22 |
| 3.1 / 3.2 | critique (docs) · test (code) | brutal-critique · sqa-engineer | subagent | pending | — | — | 2026-10-22 |
| 4.1 / 4.2 | code-review (standards, spec) | code-reviewer | subagent | pending | — | — | 2026-10-22 |

## Gates and loops
| Gate or loop | Approver / round | Decision | By | Date |
|---|---|---|---|---|
| AAW loops | limits from `node .ai-dlc/workflow.mjs rounds --json` at run start | to record | orchestrator | — |

## Open clarifications
| # | Asker → upstream | Question | Round | Status |
|---|---|---|---|---|
| 1 | orchestrator → human | Confirm the Routing Plan and who runs the measurement | — | open |

## Next action
In the new session: run `node .ai-dlc/workflow.mjs validate` and `rounds --json`, record this session in `session`, confirm the Routing Plan with the human, then write `1-orchestrator-to-research-assistant.handoff.md` and spawn research-assistant.
