---
description: Detects and resolves drift between .claude/rules/*.md (Claude rules) and .github/instructions/*.instructions.md (Copilot instructions files). Ensures every rule has a matching instructions file and vice versa.
---

Audits all rule/instructions pairs for platform drift, flags orphan files, and syncs content from Claude rules to Copilot instructions files.

## Usage

- `Skill("rules-instructions-sync", args: "audit")` — list all rules and instructions files, flag orphans and content drift
- `Skill("rules-instructions-sync", args: "sync <name>")` — sync a named rule→instructions pair
- `Skill("rules-instructions-sync", args: "sync-all")` — sync all rule/instructions pairs
- `Skill("rules-instructions-sync", args: "diff <name>")` — show structured diff between Claude rule and Copilot instructions file for one name

## Expected Workflow

1. Phase 0: load CLAUDE.md, AGENTS.md, and persistent memory via `manage-memory`.
2. Glob both rules and instructions directories to build the inventory.
3. For `audit`: cross-reference all pairs, classify orphans and drift, emit report.
4. For `sync <name>`: read Claude rule, derive Copilot instructions content (preserving `applyTo` if present), write `.github/instructions/<name>.instructions.md`.
5. For `sync-all`: iterate all Claude rules, sync each non-deprecated pair, summarise results.
6. For `diff <name>`: compare frontmatter and body sections, output structured diff table.

## Safety Defaults

- Claude rule is the authoritative source during sync.
- Copilot-specific `applyTo` frontmatter is preserved during sync and not overwritten.
- No rule or instructions file is ever deleted.
