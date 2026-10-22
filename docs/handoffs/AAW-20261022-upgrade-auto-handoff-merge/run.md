---
run: AAW-20261022-upgrade-auto-handoff-merge
status: active
lifecycle: AAW
branch: fix/auto-handoff-chain
session: 7dad6963-9400-4733-8bc7-998ae3d59007
current-stage: change
last-record: 1-agent-manager-to-orchestrator.handback.md
commit: d77b4d7
mode: parallel subagents
updated: 2026-10-22 17:30
---

# Run state: workflow upgrade merges auto-handoff.json (P2)

## Request
Human chose (2026-10-22): `/ai-dlc:workflow upgrade` also runs the `.ai-dlc/auto-handoff.json` add/remove merge that init and configure-auto-handoff do. The workflow skill is agent-manager's own, so a freshly spawned agent-manager makes exactly this change.

## Stages
| Step | Stage | Agent | Status | Handoff | Handback |
|---|---|---|---|---|---|
| 1 | change | agent-manager (fresh) | done; orchestrator verification pending | 1-orchestrator-to-agent-manager.handoff.md | 1-agent-manager-to-orchestrator.handback.md (agent: passed) |
| 2.x | critique / test | brutal-critique, sqa-engineer | pending | | |
| 3 | code-review (single pass) | code-reviewer | pending | | |

## Gates and loops
AAW has no gates. Limits from `node .ai-dlc/workflow.mjs rounds --json` (2026-10-22): AAW/critique 2/1, AAW/test 2/1, AAW/code-review 2/1. Human one-off (2026-10-22): code review is one pass covering both axes; two passes only if it requests changes.

## Next action
Continue this stage from the session handoff `.scratch/AAW-20261022-flagged-followups/session-20261022-1730.md` (session 7dad6963-9400-4733-8bc7-998ae3d59007, 2026-10-22 17:30).

Planned action underneath: verify step 1 (build --check, repo tests, workflow validate, both validate --strict; read workflow SKILL.md upgrade step 6); docs only, so spawn brutal-critique as step 2. docs/plugins.md is also edited by flagged-followups: review after both land.
