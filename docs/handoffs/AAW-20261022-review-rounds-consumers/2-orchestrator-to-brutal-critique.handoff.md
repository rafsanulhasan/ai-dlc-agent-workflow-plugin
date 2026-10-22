---
run: AAW-20261022-review-rounds-consumers
work-item: WI-2a
lifecycle: AAW
step: 2
from: orchestrator
to: brutal-critique
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 2 orchestrator → brutal-critique: critique the documents that use the review limits

## Context
- Design source: `plugins/claude/ai-dlc/skills/workflow/SKILL.md` and `references/aaw-review.md`.
- Brief: `1-orchestrator-to-agent-manager.handoff.md`. Change: `1-agent-manager-to-orchestrator.handback.md`.
- Orchestrator evidence (real):
  - `build-copilot --check` passes.
  - Tests: 263/263 pass.
  - `.ai-dlc/workflow.{json,schema.json,mjs}` are byte-identical to the templates.
  - `.ai-dlc/workflow.mjs validate` reports valid.
- No code review this round: the only code is the identical `.ai-dlc/workflow.mjs` copy of the template reviewed in WI-1.

## Docs paths (`git diff` each)
- plugins/claude/ai-dlc/agents/orchestrator.md (and root AGENTS.md, which must match it)
- plugins/claude/ai-dlc/skills/init/SKILL.md
- plugins/claude/ai-dlc/skills/ai-dlc/SKILL.md
- plugins/claude/ai-dlc/skills/agent-invocation/SKILL.md
- plugins/claude/ai-dlc/skills/request-routing/SKILL.md
- plugins/claude/ai-dlc/skills/handoff/SKILL.md
- README.md
- docs/plugins.md

## Check especially
- Each doc agrees with the design. Watch for:
  - stops on `maxFailures` as well as `maxRounds`
  - the human is asked once per stopped step
  - a fix round counts against the limits
  - the orchestrator uses `rounds --json` and never resolves precedence itself, except for DW↔BC critique stages, which have no loop
- Nothing still says shared budget, a fixed 3, or "clarify default 3".
- The init steps: the review-limit question; merge (never replace) for an existing workflow.json; the JSONC-safe settings.json merge that adds only missing keys.
- The writing guide is followed.
- Known open point from WI-1's critique (out of scope here, do not repeat): "raise the limits for this run" is not yet defined.

## Instructions
- Read-only.
- Line 1: `handoff 2-orchestrator-to-brutal-critique.handoff.md: passed|failed — <why>`.
- Then compact findings and PASS / REVISE.

## Suggested skills
- skill-management
