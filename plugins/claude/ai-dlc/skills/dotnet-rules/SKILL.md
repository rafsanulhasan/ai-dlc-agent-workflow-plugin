---
name: dotnet-rules
description: "Installs the AI-DLC .NET rules into the current repository: C# coding style, the GlobalUsings convention and the dotnet test / dotnet stryker testing gates, as Claude rules (.claude/rules) with identical GitHub Copilot instruction twins (.github/instructions). Called by init when it detects a .NET project; run it directly to add, repair or update the rules. Only for repositories that contain a .sln, .slnx or .csproj."
disable-model-invocation: true
---

# .NET rules

These rules are .NET-specific, so they are installed only into .NET repositories, never into other stacks. The files come from `${CLAUDE_SKILL_DIR}/templates/`.

## When to use

- `init` uses this skill when Phase 0 finds a `*.sln`, `*.slnx` or `*.csproj` (outside `bin/`, `obj/`, `node_modules/`).
- The user asks to add, repair or update the .NET rules.

If the repository has no .NET project file, stop and say so — do not install the rules.

## What gets installed

| Rule | Claude (`.claude/rules/`) | Copilot (`.github/instructions/`) | Applies to |
|---|---|---|---|
| C# coding style | `coding-style.md` | `coding-style.instructions.md` | `**/*.cs` |
| GlobalUsings convention | `global-usings.md` | `global-usings.instructions.md` | `**/*.cs` |
| Testing gates (`dotnet test`, then `dotnet stryker`; artifact-only changes exempt) | `testing.md` | `testing.instructions.md` | everything |

## Install

1. Confirm the repository is a .NET project (see above).
2. If `init` collected different build / test / mutation commands, replace `dotnet test` and `dotnet stryker` in both `testing` files with those commands.
3. For each file in `templates/rules/`, write it to `.claude/rules/`; for each file in `templates/instructions/`, write it to `.github/instructions/`. Create the folders if needed.
4. For a file that already exists and differs, show a unified diff of the proposed merge and write only with the user's consent. Never delete rules the project already has.
5. Keep each rule and its Copilot twin identical in body; only the frontmatter differs (`paths` vs `applyTo`).

## Report

List each file created, merged or left unchanged.
