---
name: rules-instructions-sync
description: Detects and resolves drift between .claude/rules/*.md (Claude rules) and .github/instructions/*.instructions.md (Copilot instructions files). Ensures every rule has a matching instructions file and vice versa. Invoked exclusively by the agent-manager agent.
---

# Rules and Instructions Sync

Use this skill when rule and instructions files have drifted apart, when a rule was added to one platform but not the other, or when a full rules/instructions audit is needed. Parse the args to determine the operation mode, then execute the corresponding procedure.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md` to internalize project conventions and portability rules.
2. Invoke `Skill("manage-memory", args: "agent-manager")` to load persistent memory (prior sync decisions, known rule names, naming conventions).
3. Glob `.claude/rules/*.md` and `.github/instructions/*.instructions.md` to build the current rules/instructions inventory.

---

## Mode: audit

**Args:** `audit`

List all rules and instructions files, flag orphans and content drift.

1. Glob `.claude/rules/*.md` — for each file read frontmatter and extract: `name` (derived from filename), `description` or first heading, `status`.
2. Glob `.github/instructions/*.instructions.md` — for each file read frontmatter and extract: `name` (derived from filename, strip `.instructions.md` suffix), `description` or first heading, `applyTo` (if present).
3. Normalise names: strip `.md` / `.instructions.md` extensions to get the bare rule name.
4. Build a cross-reference map keyed on bare name.
5. Classify each entry:
   - **present-both** — `.claude/rules/<name>.md` and `.github/instructions/<name>.instructions.md` both exist
   - **rule-only** — `.claude/rules/<name>.md` exists but no `.github/instructions/<name>.instructions.md`
   - **instructions-only** — `.github/instructions/<name>.instructions.md` exists but no `.claude/rules/<name>.md`
   - **drifted** — both files exist but their content (description, first heading, or body) differs significantly
6. For **drifted** pairs, show the first heading or description from each side.
7. Output a structured audit report:

```
## Rules / Instructions Drift Report

| Name | Claude rule | Copilot instructions | Status | Drift |
|------|-------------|---------------------|--------|-------|
| <name> | ✅ | ✅ | in sync | — |
| <name> | ✅ | ❌ | — | missing instructions file |
| <name> | ❌ | ✅ | — | missing rule file |
| <name> | ✅ | ✅ | drifted | content mismatch |
```

8. Summarise counts: total pairs, fully in sync, drifted, orphans.

---

## Mode: sync

**Args:** `sync <name>`

Sync a single named rule→instructions pair, using the Claude rule as the authoritative source.

1. Read `.claude/rules/<name>.md`; fail with a clear error if it does not exist.
2. Read `.github/instructions/<name>.instructions.md` if it already exists (to detect what would change).
3. Derive the Copilot instructions file content from the Claude rule:
   - Preserve any `applyTo` frontmatter from the existing Copilot file if it does not conflict.
   - Copy body content verbatim from the Claude rule.
   - Set `description` frontmatter to match the Claude rule's `description` if present.
4. Write `.github/instructions/<name>.instructions.md`.
5. Confirm: "Rule `<name>` synced to `.github/instructions/<name>.instructions.md`."

---

## Mode: sync-all

**Args:** `sync-all`

Run `sync <name>` for every rule currently in the Claude rules directory.

1. Glob `.claude/rules/*.md` — collect all bare names.
2. Filter out rules with `status: deprecated` in frontmatter (skip deprecated, report them separately).
3. For each remaining name, execute **Mode: sync** in sequence.
4. Produce a summary: pairs synced, pairs skipped (deprecated), any errors encountered.

---

## Mode: diff

**Args:** `diff <name>`

Show a structured diff between the Claude rule and Copilot instructions file for a single name.

1. Read `.claude/rules/<name>.md`; fail if it does not exist.
2. Read `.github/instructions/<name>.instructions.md`; fail if it does not exist.
3. Compare frontmatter:
   - `description` — show both; flag if different
   - `applyTo` — Copilot only; note presence/absence
   - `status` — show both if present
4. Compare body sections: identify headings present in one file but absent from the other; compare first 200 chars of each matching section.
5. Output:

```
## Rule/Instructions Diff: <name>

### Frontmatter
| Field | Claude rule | Copilot instructions |
|-------|-------------|---------------------|
| description | <val> | <val> |
| applyTo | n/a | <val> |
| status | <val> | <val> |

### Body Sections
| Section heading | Claude rule | Copilot instructions |
|-----------------|-------------|---------------------|
| ## Overview | ✅ | ✅ |
| ## Examples | ✅ | ❌ |
```

6. Conclude with: **In sync** / **Drifted — run `sync <name>` to resolve**.

---

## Validation Rules

- Every Claude rule (`.claude/rules/<name>.md`) should have a matching Copilot instructions file (`.github/instructions/<name>.instructions.md`).
- Rule and instructions file names must be identical (modulo the `.instructions.md` vs `.md` extension difference).
- Never delete any rule or instructions file — use deprecation patterns when retiring.
- Never read or modify `.env` files or sensitive configuration.
