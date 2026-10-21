---
name: agent-memory-tracked
description: Since 2026-10-21 .claude/agent-memory/ is committed everywhere, one folder per agent named like Claude Code's native one (ai-dlc-<agent>)
metadata:
  type: project
---

Decided by the human on 2026-10-21 (run AAW-20261021-track-agent-memory):

- Agent memory is tracked by git in the plugin repo and every target repo. This reverses the 2026-10-10 rule that ignored it in the plugin repo. `init` checks `git check-ignore` and changes ignore rules only on an explicit yes; `manage-memory` forbids secrets and personal data.
- One memory folder per agent, the Claude Code ID with `:` replaced by `-`: `ai-dlc-<agent>` for plugin agents, `<agent>` for project-local ones, the same on Copilot. The rule lives in `manage-memory` ("Memory folder"); `init` moves folders an earlier init wrote under the bare ID.
- Memory files use `metadata.type`, not a flat `type`.

**Why:** the team must share what agents learn, and two folders per agent (init wrote `orchestrator/`, Claude Code `ai-dlc-orchestrator/`) split the orchestrator's memory.

**How to apply:** never add an ignore rule for agent memory; write every memory path through the "Memory folder" rule; keep secrets and personal data out. Related: [[handoff-gaps]].
