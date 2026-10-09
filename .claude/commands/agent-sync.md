---
description: Detects and resolves platform drift between .claude/agents/*.md (Claude Code) and .github/agents/*.agent.md (Copilot/VS Code). Produces a drift report and applies corrective edits.
---

Audits the full agent roster for platform drift and applies corrective syncs using the Tool Exclusion List. Every agent defined in `.claude/agents/` must have a matching counterpart in `.github/agents/`.

## Usage

- `Skill("agent-sync", args: "audit")` — scan all agents, report drift (missing files, frontmatter differences, tools array divergence)
- `Skill("agent-sync", args: "sync <name>")` — sync a named agent from Claude → Copilot applying tool exclusion rules
- `Skill("agent-sync", args: "sync-all")` — run sync for every agent in the roster
- `Skill("agent-sync", args: "diff <name>")` — show a structured diff between Claude and Copilot versions of one agent

## Expected Workflow

1. Phase 0: load CLAUDE.md, AGENTS.md, and persistent memory via `manage-memory`.
2. Glob both agent directories to build the roster index.
3. For `audit`: cross-reference all agents, classify drift, emit report.
4. For `sync <name>`: read Claude definition, apply tool exclusion list, write Copilot counterpart.
5. For `sync-all`: iterate roster, sync each non-deprecated agent, summarise results.
6. For `diff <name>`: compare frontmatter and body sections, output structured diff table.

## Safety Defaults

- The Claude-only Tool Exclusion List is always applied: `Bash`, `Glob`, `Grep`, `Read`, `TodoWrite`, `WebFetch`, `WebSearch`, `PushNotification`, `ToolSearch` are never copied to `.github/agents/`.
- Deprecated agents are skipped during `sync-all` and reported separately.
- No agent file is ever deleted.
