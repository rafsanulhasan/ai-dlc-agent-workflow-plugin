---
run: AAW-20261022-review-rounds-agent-manager
work-item: WI-2b
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 1 orchestrator → agent-manager: update agent-manager's own definition for per-reviewer review limits

## Goal
`plugins/claude/ai-dlc/agents/agent-manager.md` (around :180 and :184) still describes the AAW review as "one shared round budget". WI-1 replaced that model: each review step now has its own `maxRounds` and `maxFailures`. This change is to agent-manager's own definition, so it goes to a fresh instance and this brief is the whole task.

## The design (source of truth)
`plugins/claude/ai-dlc/skills/workflow/SKILL.md` (*How the orchestrator applies it*, precedence table) and `references/aaw-review.md`:
- every AAW review step (critique, test, code-review) has its own `maxRounds` / `maxFailures`, default 2 / 1, with `maxRounds >= maxFailures + 1`; there is no shared budget
- the values in effect come from `node .ai-dlc/workflow.mjs rounds --json`, which applies env overrides from `.claude/settings.local.json` → `.claude/settings.json` → the process environment
- when a step stops with findings open, the human decides: raise the limits for this run, or stop / accept

## Change
- Edit only `plugins/claude/ai-dlc/agents/agent-manager.md`.
- Rewrite every mention of a shared round budget, a fixed number of rounds or "all three equal" to match the design. Keep it brief, and point to `aaw-review.md` instead of restating it.
- Run `node tools/build-copilot.mjs`, then `--check`.

## Suggested skills
- `agent-management`
- `skill-management` (writing guide)

## Instructions for the receiver
- Line 1 of your report: `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`.
- End with **Changed paths** (code / docs / generated), **Intent** and **Checks** with real output.
- Do not touch any other file, and do not commit.
- Another agent-manager instance is editing other files in parallel (WI-2a); a `build-copilot` run may show its changes too.
- Review: brutal-critique, 1 round.
