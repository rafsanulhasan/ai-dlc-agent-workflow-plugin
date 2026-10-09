---
name: skills-sync
description: Detects and resolves drift between .claude/skills/<name>/SKILL.md and .github/skills/<name>/SKILL.md. Also validates that every skill has a matching command (.claude/commands/<name>.md) and prompt (.github/prompts/<name>.prompt.md). Invoked exclusively by the agent-manager agent.
---

# Skills Sync

Use this skill when skill definitions on Claude Code and GitHub have drifted apart, when a skill directory was added to one platform but not the other, or when a full skill inventory audit is needed. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md` to internalize project conventions and portability rules.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory (prior sync decisions, known skill names, naming conventions).
3. Glob `.claude/skills/*/SKILL.md` and `.github/skills/*/SKILL.md` to build the current skill inventory.
4. Glob `.claude/commands/*.md` and `.github/prompts/*.prompt.md` to build the command/prompt inventory.

---

## Mode: audit

**Args:** `audit`

Scan all skill directories, report missing counterparts and content drift.

1. Glob `.claude/skills/*/SKILL.md` — for each file extract: skill name (from parent directory name), `name`, `description`, `model`, `tools` from frontmatter.
2. Glob `.github/skills/*/SKILL.md` — for each file extract: skill name (from parent directory name), `name`, `description` from frontmatter.
3. Glob `.claude/commands/*.md` — collect bare names.
4. Glob `.github/prompts/*.prompt.md` — collect bare names (strip `.prompt.md`).
5. Build a 4-column cross-reference map keyed on skill name.
6. Classify each entry:
   - **complete** — all four files exist: `.claude/skills/<name>/SKILL.md`, `.github/skills/<name>/SKILL.md`, `.claude/commands/<name>.md`, `.github/prompts/<name>.prompt.md`
   - **missing-github-skill** — `.claude/skills/<name>/SKILL.md` exists but no `.github/skills/<name>/SKILL.md`
   - **missing-claude-skill** — `.github/skills/<name>/SKILL.md` exists but no `.claude/skills/<name>/SKILL.md`
   - **missing-command** — both SKILL.md files exist but no `.claude/commands/<name>.md`
   - **missing-prompt** — both SKILL.md files exist but no `.github/prompts/<name>.prompt.md`
   - **drifted** — both SKILL.md files exist but `description`, `model`, or `tools` differ
7. For **drifted** skills, enumerate the specific field-level differences.
8. Output a structured audit report:

```
## Skills Drift Report

| Skill | .claude/skills | .github/skills | Command | Prompt | Status | Drift |
|-------|---------------|----------------|---------|--------|--------|-------|
| <name> | ✅ | ✅ | ✅ | ✅ | complete | — |
| <name> | ✅ | ❌ | ✅ | ✅ | — | missing .github/skills |
| <name> | ✅ | ✅ | ❌ | ✅ | — | missing command |
| <name> | ✅ | ✅ | ✅ | ✅ | drifted | description mismatch |
```

9. Summarise counts: total skills, complete, drifted, files missing.

---

## Mode: sync

**Args:** `sync <name>`

Sync a single named skill — copy `.claude/skills/<name>/SKILL.md` to `.github/skills/<name>/SKILL.md`.

1. Read `.claude/skills/<name>/SKILL.md`; fail with a clear error if it does not exist.
2. Check whether `.github/skills/<name>/` directory exists; create it if not via Bash: `mkdir -p .github/skills/<name>`.
3. Write `.github/skills/<name>/SKILL.md` with content identical to the Claude version.
4. Validate that the written file's frontmatter contains `name`, `description`, `model`, and `tools`.
5. Validate that Phase 0 is present in the written file (contains the string `Phase 0`).
6. Confirm: "Skill `<name>` SKILL.md synced to `.github/skills/<name>/SKILL.md`."

---

## Mode: sync-all

**Args:** `sync-all`

Sync all skills found in the Claude skills directory.

1. Glob `.claude/skills/*/SKILL.md` — collect all skill names from parent directory names.
2. Filter out skills with `status: deprecated` in frontmatter (skip deprecated, report them separately).
3. For each remaining skill name, execute **Mode: sync** in sequence.
4. Produce a summary: skills synced, skills skipped (deprecated), any errors encountered.

---

## Mode: diff

**Args:** `diff <name>`

Show a structured diff for one skill name across Claude and GitHub directories.

1. Read `.claude/skills/<name>/SKILL.md`; fail if it does not exist.
2. Read `.github/skills/<name>/SKILL.md`; note if it does not exist.
3. Compare frontmatter field by field:
   - `name` — must be identical
   - `description` — show both; flag if different
   - `model` — show both values
   - `tools` — list tools present in one but not the other
4. Compare Phase 0 section: verify both files invoke `manage-memory`.
5. Compare body sections: identify headings present in one file but absent from the other.
6. Also report:
   - `.claude/commands/<name>.md` — exists / missing
   - `.github/prompts/<name>.prompt.md` — exists / missing
7. Output:

```
## Skill Diff: <name>

### SKILL.md Frontmatter
| Field | .claude/skills | .github/skills |
|-------|---------------|----------------|
| name | <val> | <val> |
| description | <val> | <val> |
| model | <val> | <val> |
| tools | <val> | <val> |

### Phase 0 Present
| | .claude/skills | .github/skills |
|-|---------------|----------------|
| manage-memory call | ✅ / ❌ | ✅ / ❌ |

### Companion Files
| File | Status |
|------|--------|
| .claude/commands/<name>.md | ✅ / ❌ |
| .github/prompts/<name>.prompt.md | ✅ / ❌ |
```

8. Conclude with: **In sync** / **Drifted — run `sync <name>` to resolve**.

---

## Validation Rules

- Every skill must have all four files: `.claude/skills/<name>/SKILL.md`, `.github/skills/<name>/SKILL.md`, `.claude/commands/<name>.md`, `.github/prompts/<name>.prompt.md`.
- All SKILL.md files must have frontmatter: `name`, `description`, `model`, `tools`.
- All SKILL.md files must have a Phase 0 that reads CLAUDE.md and calls `manage-memory`.
- Never delete any skill file — use deprecation patterns when retiring.
- Never read or modify `.env` files or sensitive configuration.
