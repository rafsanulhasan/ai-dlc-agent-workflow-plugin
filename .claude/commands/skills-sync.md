---
description: Detects and resolves drift between .claude/skills/<name>/SKILL.md and .github/skills/<name>/SKILL.md. Also validates that every skill has a matching command (.claude/commands/<name>.md) and prompt (.github/prompts/<name>.prompt.md).
---

Audits the full skills inventory for platform drift across all four required files per skill, and syncs SKILL.md content from Claude to GitHub.

## Usage

- `Skill("skills-sync", args: "audit")` — scan all skill directories, report missing counterparts and content drift
- `Skill("skills-sync", args: "sync <name>")` — sync a named skill across Claude and GitHub directories
- `Skill("skills-sync", args: "sync-all")` — sync all skills
- `Skill("skills-sync", args: "diff <name>")` — show structured diff for one skill name

## Expected Workflow

1. Phase 0: load CLAUDE.md, AGENTS.md, and persistent memory via `manage-memory`.
2. Glob all four file surfaces to build the full skill inventory.
3. For `audit`: cross-reference all skills against all four required files, classify completeness and drift, emit report.
4. For `sync <name>`: read `.claude/skills/<name>/SKILL.md`, create `.github/skills/<name>/` if needed, write identical content to `.github/skills/<name>/SKILL.md`.
5. For `sync-all`: iterate all Claude skills, sync each non-deprecated one, summarise results.
6. For `diff <name>`: compare frontmatter, Phase 0, and body sections; report companion file presence.

## Safety Defaults

- `.claude/skills/<name>/SKILL.md` is always the authoritative source during sync.
- Deprecated skills are skipped during `sync-all` and reported separately.
- No skill file is ever deleted.
- Phase 0 presence is validated on every write.
