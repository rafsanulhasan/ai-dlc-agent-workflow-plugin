---
description: Detects and resolves drift between .claude/commands/*.md (Claude commands) and .github/prompts/*.prompt.md (Copilot prompt files). Ensures every command has a matching prompt and vice versa.
---

Audits all command/prompt pairs for platform drift, flags orphan files, and syncs content from Claude commands to Copilot prompts.

## Usage

- `Skill("command-prompt-sync", args: "audit")` — list all commands and prompts, flag orphans and content drift
- `Skill("command-prompt-sync", args: "sync <name>")` — sync a named command→prompt pair
- `Skill("command-prompt-sync", args: "sync-all")` — sync every command/prompt pair in the repo
- `Skill("command-prompt-sync", args: "diff <name>")` — show structured diff between Claude command and Copilot prompt for one name

## Expected Workflow

1. Phase 0: load CLAUDE.md, AGENTS.md, and persistent memory via `manage-memory`.
2. Glob both command and prompt directories to build the inventory.
3. For `audit`: cross-reference all pairs, classify orphans and drift, emit report.
4. For `sync <name>`: read Claude command, derive Copilot prompt content, write `.github/prompts/<name>.prompt.md`.
5. For `sync-all`: iterate all commands, sync each pair, summarise results.
6. For `diff <name>`: compare frontmatter and body sections, output structured diff table.

## Safety Defaults

- Claude command is the authoritative source during sync.
- No command or prompt file is ever deleted.
- Copilot prompt files always retain `agent: "agent"` frontmatter.
