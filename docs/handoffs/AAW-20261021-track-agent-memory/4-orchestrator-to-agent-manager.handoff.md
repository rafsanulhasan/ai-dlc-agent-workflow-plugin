---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 4
from: orchestrator
to: agent-manager
mode: subagent
loop: none
verification: pending
date: 2026-10-21
---

# Handoff 4: orchestrator -> agent-manager (fresh instance, self-change)

## Goal
Exactly one change to your own definition and a skill you own: use the single memory-folder rule decided by the human on 2026-10-21. Each agent has exactly one memory folder under `.claude/agent-memory/`, named like Claude Code's native `memory: project` folder: the agent's Claude Code id with `:` replaced by `-` — plugin agents `ai-dlc-<agent>` (e.g. `ai-dlc-orchestrator`), project-local agents `<agent>`. Same folder on Copilot.

Today `init` and `manage-memory` write by bare agent ID (`.claude/agent-memory/orchestrator/`) while Claude Code writes `ai-dlc-orchestrator/`, splitting memory. A parallel agent-manager (step 2.l1) is fixing `init`, `manage-memory` and the memory files; do not touch those.

## Your scope (only these)
1. `plugins/claude/ai-dlc/agents/agent-manager.md` — memory scaffold (`:168`, `.claude/agent-memory/<name>/MEMORY.md`) and rename (`:48`, `user_persona-name.md` + roster) → the folder rule. Point to `manage-memory`'s "Committed with the repository" section once (memory is committed; no secrets or personal data).
2. `plugins/claude/ai-dlc/skills/agent-management/SKILL.md:56-59` — memory scaffold → the folder rule (plugin agents vs project-local agents), with the same pointer.
3. Rebuild: `node tools/build-copilot.mjs`, `--check`.

## Constraints
Do not touch any other file. Do not write under docs/handoffs/. Do not commit.

## Deliverable
Line 1: `handoff 4-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Then changed paths with kind, intent, checks with real result lines.
