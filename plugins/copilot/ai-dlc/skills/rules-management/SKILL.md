---
name: rules-management
description: Create, modify, delete, and sync Claude rules files (.claude/rules/*.md) and GitHub Copilot instruction files (.github/instructions/*.instructions.md) safely using a discovery-first, non-destructive workflow. Invoked by agent-manager whenever a rules or instructions file lifecycle operation is requested.
---

# Rules and Instructions Management

> **Scope.** This skill manages *project-scope* artifacts in a consumer repository (`.claude/` and `.github/` twins). To change the shared `ai-dlc` plugin itself, edit `plugins/claude/ai-dlc/` in the plugin repository and run `node tools/build-copilot.mjs` — see **Boris Cherny** (`agent-manager`)'s *Two Scopes of Ownership*.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

Use this skill when a user asks to create, update, or remove a repository rule or instruction file on either the Claude Code or GitHub Copilot platform in this repository.

This skill is platform-aware and actionable. It always discovers existing rule and instruction files first, then applies minimal, reversible changes. Both platforms are kept in sync unless a platform-specific scope is explicitly requested.

This skill is invoked by `agent-manager` for rules and instructions lifecycle operations.

---

## Inputs Expected

- Operation: `create` | `modify` | `delete` | `sync`
- Platform target: `claude` | `copilot` | `both` (default: `both`)
- Rule/instruction name: kebab-case identifier
- Description: what the rule or instruction enforces
- Scope pattern: `paths` (a list of globs) for Claude rules and `applyTo` (the same globs, comma-separated) for Copilot instructions; none means the rule always applies
- Body: the markdown guidance content to enforce

If any required input is missing, ask only the minimum clarifying questions needed to proceed.

---

## Phase 0 - Context Load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`.
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
paths:
  - "src/**/*.ts"
---

# <Rule Title>

<rule body>
```

Omit `paths` for a rule that always applies.

**Copilot instruction** - generate `.github/instructions/<name>.instructions.md` from the rule with `node .claude/scripts/sync-harness.mjs --only rules --name <name> --prefer claude` (follow *For agents* in `../harness-sync/SKILL.md`). It writes the same body with `applyTo: "src/**/*.ts"` (comma-separated for several globs; `"**"` when the rule has no `paths`) and keeps Copilot-only keys such as `excludeAgent`.

### modify

1. Read both existing files.
2. Apply requested changes to the frontmatter (`description`, `paths`) and body of the Claude rule. A rule that still has the older `globs` key: rename it to `paths`, as a list.
3. Bring the Copilot twin in step as in `create`, unless a platform-specific change is explicitly requested.
4. Preserve all unrelated content.

### delete

1. Default to **soft delete**: rename to `<name>.md.deprecated` (Claude) or `<name>.instructions.md.deprecated` (Copilot).
2. Hard delete only with explicit `hard-delete` flag and user confirmation.
3. Report what was removed or archived.

### sync

Follow *For agents* in `../harness-sync/SKILL.md`. When you sync one item and both of its twins were edited, run `node .claude/scripts/sync-harness.mjs --check --only rules --name <name>` first, ask the human which side wins, then sync with `--prefer claude` or `--prefer copilot`; never let `newer` decide. Otherwise run `node .claude/scripts/sync-harness.mjs --only rules --name <name> --prefer claude|copilot`, naming the side the user named or the side you changed. Done when `node .claude/scripts/sync-harness.mjs --check --only rules --name <name>` exits 0.

---

## Phase 4 - Validation

1. Confirm all written files parse as valid Markdown with correct YAML frontmatter.
2. Verify frontmatter contains at minimum a `description` field.
3. Verify the scope fields: `paths` (or none, to always apply) for Claude, `applyTo` for Copilot, naming the same globs.
4. Report any drift found (for example, rule exists but no matching instruction, or vice versa).

---

## Quality Gate

- No rule or instruction is written without a `description` field.
- Soft delete is always the default for `delete` operations.
- Both platform files must be written or updated together unless scope is explicitly restricted.
- Never read or modify `.env` or sensitive configuration files.
