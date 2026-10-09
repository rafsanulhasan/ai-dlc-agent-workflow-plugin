---
name: init
description: "Bootstraps a repository for the AI-DLC agent team: scaffolds AGENTS.md (the orchestrator persona with all its skills, plus the project's commands and gates), CLAUDE.md, recommended .claude/settings.json permissions and the docs/ skeleton the lifecycles write to. In a .NET repository it also installs the C# coding and testing rules with their Copilot twins (via dotnet-rules), the dotnet test gate hook (via dotnet-test-gate) and a Stryker config. Use once per repository, or to repair a partial setup. Never overwrites existing files without showing a diff first."
disable-model-invocation: true
---

# Initialise a repository for AI-DLC

Plugins cannot ship project rules, hooks, permissions or `AGENTS.md`, so this skill writes them into the current repository from the templates next to this file (`${CLAUDE_SKILL_DIR}/templates/`).

## Phase 0 — Inspect (silent)

1. Find the repository root (`git rev-parse --show-toplevel`, else the working directory).
2. Detect the stack. The repository is a **.NET project** when it contains a `*.sln`, `*.slnx` or `*.csproj` (outside `bin/`, `obj/`, `node_modules/`). For a .NET project, also record production `*.csproj`, test projects (`*Tests*.csproj`), an existing `.config/dotnet-tools.json`, an existing `stryker-config.json`, and whether the .NET rules (`.claude/rules/coding-style.md`, `global-usings.md`, `testing.md`) and the test gate (`enforce-tests.ps1` in `hooks.Stop` of `.claude/settings.json`) are already installed.
3. List which of these already exist: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*`, `.github/instructions/*`, `.github/hooks/*`, `docs/backlog/backlog.md`.

## Phase 1 — Confirm (one message)

Show the user a table of files to **create**, files that **exist** (will be diffed, not overwritten) and the values you detected:

- Detected stack (.NET or other)
- Product name (from the solution file name, else the repository folder name)
- Build / test / mutation commands (.NET default `dotnet build`, `dotnet test`, `dotnet stryker`; for another stack, ask)
- .NET only: the rules and test gate hook that will be installed, and the test solution the gate will run (a `*.Testing.slnx` / `*.Tests.sln` if present)
- Mutation break threshold (default 60)

For a stack other than .NET, say that the stack-specific rules and the automatic test gate are .NET-only for now and will be skipped.

Ask once for corrections, then proceed.

## Phase 2 — Write

For each template, replace the `{{PLACEHOLDERS}}` and write it. For a file that already exists, show a unified diff of the proposed merge and write only after the user agrees.

| Template | Destination |
|---|---|
| `templates/AGENTS.md` | `AGENTS.md` — the **orchestrator persona** for this project (the full `orchestrator` agent definition, its routing rules and skills) followed by the project's commands, gates, artifact locations and conventions. Fill every `{{PLACEHOLDER}}`; do not edit the persona sections. If an `AGENTS.md` exists, keep its project-specific notes and show the diff. |
| `templates/CLAUDE.md` | `CLAUDE.md` (or `.claude/CLAUDE.md` if the repo already keeps it there) |
| `templates/settings.json` | `.claude/settings.json` — **merge** `agent`, `permissions` and `env` keys into any existing file; never drop existing entries |
| `templates/stryker-config.json` | test project folder (.NET only, and only if no Stryker config exists) |
| `templates/docs/backlog.md` | `docs/backlog/backlog.md` |

Also create empty folders with a `.gitkeep`: `docs/specs/`, `docs/architecture/decisions/`, `docs/architecture/narratives/`, `docs/plans/`, `docs/handoffs/`, `docs/product/`.

**.NET projects only:**

- Install the rules: read `${CLAUDE_SKILL_DIR}/../dotnet-rules/SKILL.md` and follow its **Install** section, passing the build / test / mutation commands confirmed in Phase 1. It writes the C# coding-style, GlobalUsings and testing rules to `.claude/rules/` and their twins to `.github/instructions/`.
- Install the test gate: read `${CLAUDE_SKILL_DIR}/../dotnet-test-gate/SKILL.md` and follow its **Install** section (both skills are user-invocable only, so read them rather than calling them). It copies `enforce-tests.ps1` to `.claude/hooks/`, merges the `Stop` hook into `.claude/settings.json` and writes `.github/hooks/ai-dlc-test-gate.json` for Copilot. Skip it if the gate is already installed and identical.
- If there is no local tool manifest, offer (do not run without consent): `dotnet new tool-manifest && dotnet tool install dotnet-stryker`.

## Phase 3 — Report

List every file created or changed, then the next step:

> The orchestrator is now the default agent for this repo (`"agent": "ai-dlc:orchestrator"` in `.claude/settings.json`), so every request reaches it first. One-off alternative: `claude --agent ai-dlc:orchestrator`. On Copilot, select the `orchestrator` custom agent.

## Rules

- Never overwrite without a diff and consent. Never touch `.env` files.
- Keep rules and their Copilot twins identical in body; only frontmatter differs (`paths` vs `applyTo`).
