---
run: AAW-20261024-docs-in-progress-rule
status: done
lifecycle: AAW
mode: subagent
branch: feat/ai-dlc-lens
session: 5bbdde00-5281-4870-a2a6-8f779f16e87b
commit: 2a4ce11
last-record: 1.2.l2-documentation-writer-to-orchestrator.handback.md
updated: 2026-10-23 14:10
---

# Run: docs mark a feature an agent is building as "in progress" — shipped as a plugin rule

## Request
The human (2026-10-24), on the lens README that called the anomaly detector "planned" while an agent was building it: "make it in progress while an agent is working on it. it ship with the plugin as a rule. not as an agent memory only" — confirmed: "Yes, README status rule".

## Clarified intent
- Documentation marks a feature that an agent is currently building (its run stage `in-progress`) as **in progress**, not "planned"; "planned" is for work not started; when the work is done the status marker is removed or replaced by the real description.
- The convention is universal — **all workflows / lifecycles and all agents** (human, 2026-10-24: "its not for only the current workflow. it applies to all workflow and all agents") — and ships with the ai-dlc plugin as a **rule**, installed into target repositories by `/ai-dlc:init` like the other rules, and in this repository — not only in an agent's memory.
- Only **documentation-writer** writes docs; every other agent owns its work and instructs documentation-writer to author or update the docs (human, 2026-10-24: "the agent will just own it and instruct doc writer to author it. its the doc writer who will write the docs").
- The lens README is fixed under this rule in AAW-20261023-lens-plugin-from-spike step 1.6.2.l1.

## Routing
Agent Artifact (rule + install path + agent/skill references) → AAW. agent-manager → docs: brutal-critique (code path if an install script changes). Reviews wait until AAW-20261023-lens-plugin-from-spike step 1.6 is done (human, 2026-10-24).

## Gates and loops
AAW/critique 2/1 · AAW/test 2/1 · AAW/code-review 2/1 · critique round 1 used (REVISE), 1 round left

## Stages
| Step | Stage | Agent | Status | Record |
|---|---|---|---|---|
| 1 | write the rule, ship it with the plugin (init installs it), install it here, point the docs agents at it | agent-manager | output landed, hand-back lost (agent unreachable after session handoff) | 1-orchestrator-to-agent-manager.handoff.md |
| 1.l1 | check step 1 output against its brief, finish it, run checks, hand back | agent-manager | done (passed) · no edits needed; requests: plugin-management README lines (fresh agent-manager), Docs updates for docs/plugins.md + README.md | 1.l1-agent-manager-to-orchestrator.handback.md |
| 1.1 | plugin-management: README work → Docs update request (fresh agent-manager) | agent-manager | done (passed) · 3 lines (§7.5, §10.4, checklist) | 1.1-agent-manager-to-orchestrator.handback.md |
| 1.2 | docs: docs-status rule and docs-rules skill in docs/plugins.md, README.md | documentation-writer | done (passed) · no marker (step 1 done); note: docs/plugins.md Bootstrap omits model-metadata (out of scope) | 1.2-documentation-writer-to-orchestrator.handback.md |
| 2 | critique (all docs; no code) | brutal-critique | done · REVISE round 1 of 2 (2 Blockers: done-vs-reviews status undefined; docs/ scope hits PO/architect/PM artifacts; 5 Major, 3 Minor) | 2-brutal-critique-to-orchestrator.handback.md |
| 1.l2 | fix round 1: every critique finding; human: in progress until reviews pass | agent-manager | done (passed) · all 10 findings fixed; 2 interpretations for the critique (pre-build stages keep planned; release is not a review stage) | 1.l2-agent-manager-to-orchestrator.handback.md |
| 1.2.l1 | docs: in-progress markers + revised rule in docs/plugins.md, README.md | documentation-writer | done (passed) · in-progress markers in 3 docs; remove after the last review | 1.2.l1-documentation-writer-to-orchestrator.handback.md |
| 2.l1 | critique round 2 (last): revised rule + docs | brutal-critique | done · PASS (0 Blockers, 0 Major, 4 Minor) | 2.l1-brutal-critique-to-orchestrator.handback.md |
| 1.l3 | closing fix: release go/no-go is not a review stage (Minor 1) | agent-manager | done (passed) | 1.l3-agent-manager-to-orchestrator.handback.md |
| 1.2.l2 | docs: remove the in-progress markers (last review done) | documentation-writer | done (passed) · markers removed | 1.2.l2-documentation-writer-to-orchestrator.handback.md |

## Next action
Done (critique PASS round 2; closing fixes 1.l3 and 1.2.l2 checked). Commit pending: per the lens run's commit plan (human: separate commits per run once everything completes); this run's hunks share files with the verify-only run (orchestrator.md, AGENTS.md) and need hunk-level staging.

## Session handoff
- 2026-10-23 10:38 — session 5bbdde00 took over from 4ef2c10f (automatic context-limit handoff, `.scratch/AAW-20261024-docs-in-progress-rule/session-20261023-1036.md`). On resume, step 1 had no hand-back but its output was landing: `plugins/claude/ai-dlc/skills/docs-rules/` (SKILL.md, rules and instructions templates), `.claude/rules/docs-status.md`, its `.github/instructions/` twin, the `init` wiring and a `docs-rules` folder in the Copilot plugin all exist; agent-manager memory was still being written at 10:36. Not re-spawned: waiting for the writes to stop or the hand-back to arrive, then step 1 is checked against the files.

## Human decision on the critique (2026-10-23)
- Build done, reviews pending: documentation says *in progress* until the run's last review or gate stage is done; a fix round keeps it in progress → step 1.l2.
