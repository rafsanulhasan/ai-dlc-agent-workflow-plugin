---
description: Create, modify, and delete Claude Code hooks and GitHub Copilot hook integrations safely using a discovery-first, non-destructive workflow.
---

Use this command to run the `hook-management` skill when changing hook behavior across Claude Code and GitHub Copilot surfaces.

## Usage

- `Skill("hook-management", args: "create <platform> <hook-description>")`
- `Skill("hook-management", args: "modify <platform> <hook-description>")`
- `Skill("hook-management", args: "delete <platform> <hook-name> <delete-mode>")`

Where:

- `<platform>` is `claude`, `copilot`, or `both`
- `<delete-mode>` should be `soft-delete` by default; use hard delete only with explicit approval

## Expected Workflow

1. Discover existing hook files, wiring, and references before making any change.
2. Classify operation type (`create`, `modify`, `delete`) and platform scope.
3. Apply minimal, reversible edits; preserve unrelated behavior.
4. Validate wiring, references, and safety constraints.
5. Report summary, ambiguities, and recommended next checks.

## Safety Defaults

- Prefer non-destructive changes.
- For delete operations, backup first and request confirmation before irreversible removal.
- If platform hook format is ambiguous, stop and ask targeted clarifying questions.
