---
name: rules-management
description: Create, modify, delete, and sync Claude rules files (.claude/rules/*.md) and GitHub Copilot instruction files (.github/instructions/*.instructions.md) safely using a discovery-first, non-destructive workflow. Invoked by agent-manager whenever a rules or instructions file lifecycle operation is requested.
---

# Rules and Instructions Management

Use this skill when a user asks to create, update, or remove a repository rule or instruction file on either the Claude Code or GitHub Copilot platform in this repository.

This skill is platform-aware and actionable. It always discovers existing rule and instruction files first, then applies minimal, reversible changes. Both platforms are kept in sync unless a platform-specific scope is explicitly requested.

This skill is invoked by `agent-manager` for rules and instructions lifecycle operations.

---

## Inputs Expected

- Operation: `create` | `modify` | `delete` | `sync`
- Platform target: `claude` | `copilot` | `both` (default: `both`)
- Rule/instruction name: kebab-case identifier
- Description: what the rule or instruction enforces
- Scope pattern: `globs` for Claude rules and `applyTo` for Copilot instructions
- Body: the markdown guidance content to enforce

If any required input is missing, ask only the minimum clarifying questions needed to proceed.

---

## Phase 0 - Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Read repository governance files relevant to rule and instruction ownership.
4. Discover current rule and instruction surfaces before proposing edits.

---

## Phase 1 - Discovery And Classification

1. Glob `.claude/rules/*.md` - list all existing Claude rules files.
2. Glob `.github/instructions/*.instructions.md` - list all existing Copilot instruction files.
3. Build an inventory table:
   | Name | Claude rule path | Copilot instruction path | Status |
   |------|------------------|--------------------------|--------|
4. Check for drift (rule exists on one platform but not the other).
5. Classify request into one mutation strategy:
   - `create` - neither platform file exists for the given name
   - `modify` - one or both platform files exist and need updating
   - `delete` - one or both platform files must be removed
   - `sync` - files exist on both platforms but have drifted out of sync

Decision rule:
- If operation is `modify` or `delete` and the target file is not discoverable, pause and ask for disambiguation instead of guessing.

---

## Phase 2 - Plan The Change

1. Identify exact file paths for all affected files.
2. Determine minimum edit set:
   - For `create`: new file(s) to write
   - For `modify`: field(s) or section(s) to update
   - For `delete`: file(s) to archive/remove
   - For `sync`: diff both files and reconcile to the authoritative source
3. Confirm scope with the caller if ambiguous (for example, only one platform was targeted).
4. For `delete`, require explicit confirmation before any irreversible removal.

---

## Phase 3 - Execute

### create

**Claude rule** - write `.claude/rules/<name>.md`:

```markdown
---
description: <one-line description>
globs: "**/*"
alwaysApply: false
---

# <Rule Title>

<rule body>
```

**Copilot instruction** - write `.github/instructions/<name>.instructions.md`:

```markdown
---
applyTo: "**/*"
description: "<one-line description>"
---

# <Instruction Title>

<instruction body>
```

### modify

1. Read both existing files.
2. Apply requested changes to frontmatter fields (`description`, `globs`/`applyTo`, `alwaysApply`) and body sections.
3. Keep both files in sync unless a platform-specific change is explicitly requested.
4. Preserve all unrelated content.

### delete

1. Default to **soft delete**: rename to `<name>.md.deprecated` (Claude) or `<name>.instructions.md.deprecated` (Copilot).
2. Hard delete only with explicit `hard-delete` flag and user confirmation.
3. Report what was removed or archived.

### sync

1. Diff the Claude rule and Copilot instruction for the same name.
2. Identify which is authoritative (typically the one most recently updated, or the one intentionally specified by the user).
3. Reconcile the non-authoritative file to match, preserving platform-specific frontmatter fields.

---

## Phase 4 - Validation

1. Confirm all written files parse as valid Markdown with correct YAML frontmatter.
2. Verify frontmatter contains at minimum a `description` field.
3. Verify frontmatter contains scope fields (`globs` for Claude, `applyTo` for Copilot).
4. Report any drift found (for example, rule exists but no matching instruction, or vice versa).

---

## Quality Gate

- No rule or instruction is written without frontmatter and a `description` field.
- Soft delete is always the default for `delete` operations.
- Both platform files must be written or updated together unless scope is explicitly restricted.
- Never read or modify `.env` or sensitive configuration files.
