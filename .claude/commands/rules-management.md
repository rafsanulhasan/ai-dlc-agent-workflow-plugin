---
description: Create, modify, delete, or sync Claude rules files and GitHub Copilot instruction files across both platforms using a discovery-first, non-destructive workflow.
---

Use this command to run the `rules-management` skill when managing repository rule and instruction files across Claude Code and GitHub Copilot surfaces.

## Usage

- `Skill("rules-management", args: "create <name>")`
- `Skill("rules-management", args: "modify <name> <change-description>")`
- `Skill("rules-management", args: "delete <name>")`
- `Skill("rules-management", args: "delete <name> hard-delete")`
- `Skill("rules-management", args: "sync <name>")`

Where:

- `<name>` is the kebab-case rule/instruction name
- `hard-delete` is an optional flag; omit to use the default soft-delete

Platform scope defaults to `both`. To restrict to a single platform, append `platform:claude` or `platform:copilot` to the args string.

## Expected Workflow

1. Discover existing `.claude/rules/<name>.md` and `.github/instructions/<name>.instructions.md` before making any change.
2. Classify operation (`create`, `modify`, `delete`, `sync`) and platform scope.
3. Apply minimal, reversible edits; preserve all unrelated content.
4. Validate frontmatter schema and rules/instructions pairing integrity.
5. Report summary, any drift found, and recommended next checks.

## Safety Defaults

- Prefer non-destructive changes.
- For delete operations, soft-delete by default (rename to `*.deprecated`); request explicit confirmation before hard delete.
- Both platform files are written/updated together unless scope is explicitly restricted.
- Never read or modify `.env` or sensitive configuration files.
