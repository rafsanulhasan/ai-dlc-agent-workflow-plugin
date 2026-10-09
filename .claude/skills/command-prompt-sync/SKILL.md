---
name: command-prompt-sync
description: Detects and resolves drift between .claude/commands/*.md (Claude commands) and .github/prompts/*.prompt.md (Copilot prompt files). Ensures every command has a matching prompt and vice versa. Invoked exclusively by the agent-manager agent.
---

# Command-Prompt Sync

Use this skill when command and prompt files have drifted apart, when a command was added to one platform but not the other, or when a full inventory audit is needed. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md` to internalize project conventions and portability rules.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory (prior sync decisions, known naming conventions).
3. Glob `.claude/commands/*.md` and `.github/prompts/*.prompt.md` to build the current command/prompt inventory.

---

## Mode: audit

**Args:** `audit`

Scan all commands and prompts, flag orphans and content drift.

1. Glob `.claude/commands/*.md` — for each file read frontmatter and extract: `name` (derived from filename), `description`.
2. Glob `.github/prompts/*.prompt.md` — for each file read frontmatter and extract: `name` (derived from filename, strip `.prompt` suffix), `description`, `agent`, `argument-hint`.
3. Normalise names: strip `.md` / `.prompt.md` extensions to get the bare skill name.
4. Build a cross-reference map keyed on bare name.
5. Classify each entry:
   - **present-both** — command exists in `.claude/commands/` and prompt exists in `.github/prompts/`
   - **command-only** — `.claude/commands/<name>.md` exists but no `.github/prompts/<name>.prompt.md`
   - **prompt-only** — `.github/prompts/<name>.prompt.md` exists but no `.claude/commands/<name>.md`
   - **drifted** — both files exist but `description` differs significantly
6. For **drifted** pairs, show the description from each side.
7. Output a structured audit report:

```
## Command / Prompt Drift Report

| Name | Claude command | Copilot prompt | Status | Drift |
|------|---------------|----------------|--------|-------|
| <name> | ✅ | ✅ | in sync | — |
| <name> | ✅ | ❌ | — | missing prompt |
| <name> | ❌ | ✅ | — | missing command |
| <name> | ✅ | ✅ | drifted | description mismatch |
```

8. Summarise counts: total pairs, fully in sync, drifted, orphans.

---

## Mode: sync

**Args:** `sync <name>`

Sync a single named command→prompt pair, using the Claude command as the authoritative source.

1. Read `.claude/commands/<name>.md`; fail with a clear error if it does not exist.
2. Extract frontmatter `description` from the Claude command.
3. Read `.github/prompts/<name>.prompt.md` if it already exists (to detect what would change).
4. Derive the Copilot prompt content from the Claude command:
   - Frontmatter: set `description` to match Claude command's `description`; preserve or set `agent: "agent"` and `argument-hint`
   - Body: adapt the Claude command body for Copilot prompt format (see Phase 3 templates in command-management skill)
5. Write `.github/prompts/<name>.prompt.md`.
6. Confirm: "Command `<name>` synced to `.github/prompts/<name>.prompt.md`."

---

## Mode: sync-all

**Args:** `sync-all`

Run `sync <name>` for every command currently in the Claude commands directory.

1. Glob `.claude/commands/*.md` — collect all bare names.
2. For each name, execute **Mode: sync** in sequence.
3. Produce a summary: pairs synced, any errors encountered.

---

## Mode: diff

**Args:** `diff <name>`

Show a structured diff between the Claude command and Copilot prompt for a single name.

1. Read `.claude/commands/<name>.md`; fail if it does not exist.
2. Read `.github/prompts/<name>.prompt.md`; fail if it does not exist.
3. Compare frontmatter:
   - `description` — show both; flag if different
   - `agent` — Copilot only; note presence/absence
   - `argument-hint` — Copilot only; note presence/absence
4. Compare body sections: identify headings present in one file but absent from the other.
5. Output:

```
## Command/Prompt Diff: <name>

### Frontmatter
| Field | Claude command | Copilot prompt |
|-------|---------------|----------------|
| description | <val> | <val> |
| agent | n/a | <val> |
| argument-hint | n/a | <val> |

### Body Sections
| Section heading | Claude command | Copilot prompt |
|-----------------|---------------|----------------|
| ## Usage | ✅ | ✅ |
| ## Modes | ❌ | ✅ |
```

6. Conclude with: **In sync** / **Drifted — run `sync <name>` to resolve**.

---

## Validation Rules

- Both `.claude/commands/<name>.md` and `.github/prompts/<name>.prompt.md` must exist as a pair.
- `description` frontmatter is required in both files.
- Copilot prompt files must have `agent: "agent"` in frontmatter.
- Never delete any command or prompt file — use deprecation patterns when retiring.
- Never read or modify `.env` files or sensitive configuration.
