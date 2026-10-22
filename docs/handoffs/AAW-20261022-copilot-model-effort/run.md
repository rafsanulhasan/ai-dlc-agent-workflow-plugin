---
run: AAW-20261022-copilot-model-effort
status: active
lifecycle: AAW
branch: fix/auto-handoff-chain
session: 7dad6963-9400-4733-8bc7-998ae3d59007
current-stage: research
last-record: 1-research-assistant-to-orchestrator.handback.md
commit: d77b4d7
mode: parallel subagents
updated: 2026-10-22 17:30
---

# Run state: Copilot and Claude agents carry model and effort; per-spawn choice (F12)

## Request
Human chose "Build it, then document" (2026-10-22): (1) the Copilot build writes model + reasoning-effort into each .agent.md (Claude alias mapped to Copilot model list); (2) agents get a default effort; (3) agent-invocation tells the orchestrator to pick model and effort per spawn by task size (Claude Code); README describes it, incl. a note that models and effort are chosen per invocation because requests need different effort. Evidence: AAW-20261022-flagged-followups/0.3-research-assistant-to-orchestrator.handback.md.

## Stages
| Step | Stage | Agent | Status | Handoff | Handback |
|---|---|---|---|---|---|
| 1 | research (Copilot model ids, Claude effort frontmatter, Agent effort param) | research-assistant | done | 1-orchestrator-to-research-assistant.handoff.md | 1-research-assistant-to-orchestrator.handback.md (passed) |
| 2 | change | agent-manager | pending | | |
| 3.x | critique / test | brutal-critique, sqa-engineer | pending | | |
| 4 | code-review (single pass) | code-reviewer | pending | | |

## Gates and loops
AAW has no gates. Limits from `node .ai-dlc/workflow.mjs rounds --json` (2026-10-22): AAW/critique 2/1, AAW/test 2/1, AAW/code-review 2/1. Human one-off (2026-10-22): code review is one pass covering both axes; two passes only if it requests changes.

## Next action
Continue this stage from the session handoff `.scratch/AAW-20261022-flagged-followups/session-20261022-1730.md` (session 7dad6963-9400-4733-8bc7-998ae3d59007, 2026-10-22 17:30).

Planned action underneath: ask the human to confirm (a) the exact Copilot model strings from the VS Code model picker (mapping in the hand-back is unverified) and (b) the default effort per agent (research suggestion is unsourced); then brief agent-manager as step 2, after flagged-followups README/docs/plugins.md edits land.
