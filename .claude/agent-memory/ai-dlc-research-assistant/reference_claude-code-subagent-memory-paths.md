---
name: claude-code-subagent-memory-paths
description: Claude Code subagent memory scopes map to fixed directories (code.claude.com sub-agents page); no relocation option documented as of 2026-11-14
metadata:
  type: reference
---

Claude Code `memory` frontmatter (`user` | `project` | `local`) selects one of three fixed directories: `~/.claude/agent-memory/<name>/`, `.claude/agent-memory/<name>/`, `.claude/agent-memory-local/<name>/`. Source: https://code.claude.com/docs/en/sub-agents, section "Enable persistent memory".

**Why:** Needed to answer whether the team's agent memory folder can move out of `.claude/agent-memory/` (preview2 feature 8 research). The page documents no setting, env var or frontmatter option that relocates these paths; only `autoMemoryEnabled` / `CLAUDE_CODE_DISABLE_AUTO_MEMORY` disable it. The changelog sections read (through 2.1.323) had no relocation entry.

**How to apply:** Treat the host path as fixed when a plan involves moving `.claude/agent-memory/`. Verify again before acting, since the docs page was read in truncated form (first 100000 of 116580 characters). Plugin subagents honouring the `memory` field is not stated on the page; check before relying on it. GitHub Copilot agent files declare no memory field here; the folder is a plugin convention in the `manage-memory` skill, not a host path.
