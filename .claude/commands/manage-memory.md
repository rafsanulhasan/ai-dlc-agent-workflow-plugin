---
description: Manages persistent file-based memory for all agents in .claude/agent-memory/<agent-name>/. Extends persistent-memory with refresh, prune, and audit operations. All agents call this skill directly for routine load/save; route prune/audit/refresh through skill-manager.
---

All agents call this skill for memory operations:
- **load** `<agent-name>` — load all memories at session start
- **save** `<agent-name>` — save new learnings at session end
- **refresh** `<agent-name>` — force-reload the memory index
- **prune** `<agent-name>` — remove stale/duplicate entries (requires confirmation)
- **audit** — survey memory health across all agents

For prune, audit, and refresh operations, prefer invoking via `Agent("skill-manager", ...)` so changes are tracked.
