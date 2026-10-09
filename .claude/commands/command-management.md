---
description: Create, modify, or delete GitHub Copilot prompt files and Claude command files across both platforms using a discovery-first, non-destructive workflow.
---

Use this command to run the `command-management` skill when managing command or prompt files across Claude Code and GitHub Copilot surfaces.

## Usage

- `Skill("command-management", args: "create <name>")`
- `Skill("command-management", args: "modify <name> <change-description>")`
- `Skill("command-management", args: "delete <name>")`
- `Skill("command-management", args: "delete <name> hard-delete")`
- `Skill("command-management", args: "sync <name>")`

Where:

- `<name>` is the kebab-case command/prompt name (matches the linked skill name)
- `hard-delete` is an optional flag; omit to use the default soft-delete

Platform scope defaults to `both`. To restrict to a single platform, append `platform:claude` or `platform:copilot` to the args string.

## Expected Workflow

1. Discover existing `.claude/commands/<name>.md` and `.github/prompts/<name>.prompt.md` before making any change.
2. Classify operation (`create`, `modify`, `delete`, `sync`) and platform scope.
3. Apply minimal, reversible edits; preserve all unrelated content.
4. Validate frontmatter schema and skill reference integrity.
5. Report summary, any drift found, and recommended next checks.

## Safety Defaults

- Prefer non-destructive changes.
- For delete operations, soft-delete by default (rename to `*.deprecated`); request explicit confirmation before hard delete.
- Both platform files are written/updated together unless scope is explicitly restricted.
- Never read or modify `.env` or sensitive configuration files.
