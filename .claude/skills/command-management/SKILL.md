---
name: command-management
description: Create, modify, and delete GitHub Copilot prompt files (.github/prompts/*.prompt.md) and Claude command files (.claude/commands/*.md) safely using a discovery-first, non-destructive workflow. Invoked by agent-manager whenever a command or prompt needs to be created, modified, or deleted.
---

# Command and Prompt Management

Use this skill when a user asks to create, update, or remove a command or prompt on either the Claude Code or GitHub Copilot platform in this repository.

This skill is platform-aware and actionable. It always discovers existing command and prompt files first, then applies minimal, reversible changes. Both platforms are kept in sync unless a platform-specific scope is explicitly requested.

---

## Inputs Expected

- Operation: `create` | `modify` | `delete`
- Platform target: `claude` | `copilot` | `both` (default: `both`)
- Command/prompt name: kebab-case identifier matching the linked skill name
- Description: what the command does (used in frontmatter `description`)
- Body: the command content (usage examples, workflow summary, safety defaults)

If any required input is missing, ask only the minimum clarifying questions needed to proceed.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md`.
2. Invoke `Skill("manage-memory", args: "agent-manager")`.
3. Read repository governance files relevant to command and prompt ownership.
4. Discover current command and prompt surfaces before proposing edits.

---

## Phase 1 — Discovery And Classification

1. Glob `.claude/commands/*.md` — list all existing Claude command files.
2. Glob `.github/prompts/*.prompt.md` — list all existing Copilot prompt files.
3. Build an inventory table:
   | Name | Claude command path | Copilot prompt path | Linked skill | Status |
   |------|---------------------|---------------------|--------------|--------|
4. Check for drift (command exists on one platform but not the other).
5. Classify request into one mutation strategy:
   - `create` — neither platform file exists for the given name
   - `modify` — one or both platform files exist and need updating
   - `delete` — one or both platform files must be removed
   - `sync` — files exist on both platforms but have drifted out of sync

Decision rule:
- If operation is `modify` or `delete` and the target file is not discoverable, pause and ask for disambiguation instead of guessing.

---

## Phase 2 — Plan The Change

1. Identify exact file paths for all affected files.
2. Determine minimum edit set:
   - For `create`: new file(s) to write
   - For `modify`: field(s) or section(s) to update
   - For `delete`: file(s) to archive/remove
   - For `sync`: diff both files and reconcile to the authoritative source
3. Confirm scope with the caller if ambiguous (e.g., only one platform was targeted).
4. For `delete`, require explicit confirmation before any irreversible removal.

---

## Phase 3 — Execute

### create

**Claude command** — write `.claude/commands/<name>.md`:

```markdown
---
description: <one-line description>
---

<usage section with Skill() call signature>

## Usage

- `Skill("<skill-name>", args: "create <args>")`
- `Skill("<skill-name>", args: "modify <args>")`
- `Skill("<skill-name>", args: "delete <args>")`

## Expected Workflow

<numbered summary of what the skill does>

## Safety Defaults

<list any destructive-action guardrails>
```

**Copilot prompt** — write `.github/prompts/<name>.prompt.md`:

```markdown
---
description: "<one-line description>"
agent: "agent"
argument-hint: "<short arg hint>"
---

<concise summary paragraph>

## Modes

<list of supported modes/args>

## Expected Workflow

<numbered summary mirroring the SKILL.md phases>

## Safety Defaults

<list any destructive-action guardrails>
```

### modify

1. Read both existing files.
2. Apply requested changes to `description`, body sections, or usage examples.
3. Keep both files in sync unless a platform-specific change is explicitly requested.
4. Preserve all unrelated content.

### delete

1. Default to **soft delete**: rename to `<name>.md.deprecated` (Claude) or `<name>.prompt.md.deprecated` (Copilot).
2. Hard delete only with explicit `hard-delete` flag and user confirmation.
3. Report what was removed or archived.

### sync

1. Diff the Claude command and Copilot prompt for the same name.
2. Identify which is authoritative (typically the one most recently updated, or the one linked to a living skill).
3. Reconcile the non-authoritative file to match, preserving platform-specific frontmatter fields.

---

## Phase 4 — Validation

1. Confirm all written files parse as valid Markdown with correct YAML frontmatter.
2. Verify frontmatter contains at minimum a `description` field.
3. Check that the linked skill (`Skill("<name>", ...)`) reference in the command body resolves to an existing skill file.
4. Report any drift found (e.g., command exists but no matching prompt, or vice versa).

---

## Quality Gate

- No command or prompt is written without a `description` in its frontmatter.
- Soft delete is always the default for `delete` operations.
- Both platform files must be written or updated together unless scope is explicitly restricted.
- No `.env` or sensitive configuration files are read or modified.
