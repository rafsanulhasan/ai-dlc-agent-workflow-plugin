---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 1
from: orchestrator
to: research-assistant
mode: subagent
loop: none
verification: failed
date: 2026-10-21
---

# Handoff 1: orchestrator -> research-assistant (locate)

## Goal
The human wants agent memory (`.claude/agent-memory/**`) tracked by git, both in this plugin repository and in every target repository the plugin is installed into. Today this repo's `.gitignore:8` ignores `.claude/agent-memory/`. Locate everything that makes agent memory untracked or local-only, so agent-manager can fix it.

## Questions (repository: e:\Projects\personal\ai-dlc-agent-workflow-plugin)
1. This repo: every `.gitignore` / `.git/info/exclude` / `.gitattributes` rule matching `agent-memory` (path:line), and the commit that added the `.gitignore:8` rule (`git log -S "agent-memory" -- .gitignore`; quote its message if it gives a reason).
2. Plugin -> target repos: every place in `plugins/claude/ai-dlc/` (especially `skills/init/**` and its templates, `skills/manage-memory/**`, `skills/workspace-folders/**`, `skills/harness-sync/**`, `skills/plugin-management/**`, `tools/`) that writes, appends or documents a gitignore entry for agent memory, or says memory is local / not committed / per machine.
3. Every place that says the opposite (memory is project-scope, shared via version control, committed), to spot contradictions.
4. Any memory content rules relevant to committing it (e.g. "never store secrets", personal/user-type memories) in `skills/manage-memory/**` — quote them.
5. Copilot side: where Copilot keeps agent memory per the plugin docs, and whether any rule ignores it.

## Deliverable
Locate contract: `path:line — symbol/rule — note (<=6 words)`, grouped under `GitignoreRules:`, `Writers:`, `SaysLocal:`, `SaysShared:`, `ContentRules:`, then `totals:`. First line: `handoff 1-orchestrator-to-research-assistant.handoff.md: passed|failed — <why>`. Read-only.
