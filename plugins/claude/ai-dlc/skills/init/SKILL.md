---
name: init
description: "Bootstraps a repository for the AI-DLC agent team: scaffolds AGENTS.md (the orchestrator persona with all its skills, plus the project's commands and gates), CLAUDE.md, recommended .claude/settings.json permissions and the docs/ skeleton the lifecycles write to, and lets the developer name the agent team (each renamed agent remembers its name; the orchestrator keeps the roster). For each supported stack it detects it also installs the stack's coding and testing rules with their Copilot twins, a test gate hook and a Stryker config: .NET via dotnet-rules and dotnet-test-gate, JavaScript / TypeScript (Node.js) via node-rules and node-test-gate. A repository with both stacks gets both. Use once per repository, or to repair a partial setup. Never overwrites existing files without showing a diff first."
disable-model-invocation: true
---

# Initialise a repository for AI-DLC

Plugins cannot ship project rules, hooks, permissions or `AGENTS.md`, so this skill writes them into the current repository from the templates next to this file (`${CLAUDE_SKILL_DIR}/templates/`).

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Phase 0 — Inspect (silent)

1. Find the repository root (`git rev-parse --show-toplevel`, else the working directory).
2. Detect the stacks. Supported stacks are .NET and JavaScript / TypeScript; a repository can have both, and each detected stack is set up.
   - **.NET** when the repo contains a `*.sln`, `*.slnx` or `*.csproj` (outside `bin/`, `obj/`, `node_modules/`). Also record production `*.csproj`, test projects (`*Tests*.csproj`), an existing `.config/dotnet-tools.json`, an existing `stryker-config.json`, and whether the .NET rules (`.claude/rules/coding-style.md`, `global-usings.md`, `testing.md`) and the test gate (`enforce-tests.ps1` in `hooks.Stop` of `.claude/settings.json`) are already installed.
   - **JavaScript / TypeScript (Node.js)** when there is a `package.json` at the root or in a workspace package (outside `node_modules/`). It is **TypeScript** when there is a `tsconfig*.json` or a `typescript` dependency, else plain JavaScript. Also record:
     - the package manager, by lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` or `bun.lock` → bun, else npm;
     - whether it is a monorepo: `workspaces` in the root `package.json`, `pnpm-workspace.yaml`, or several `package.json` files, with the workspace package folders;
     - the test runner, from `devDependencies` / `dependencies` and the `scripts`: `vitest`, `jest`, `mocha`, or `node --test` (`node:test`); "none" if no test script;
     - the `build`, `test`, `typecheck` scripts, the source root (`src/`, `lib/`, or the workspace packages), and any formatter / linter config (ESLint, Prettier, Biome);
     - an existing Stryker config (`stryker.config.*`, `stryker.conf.*`, `.stryker.conf.*`), a pre-commit setup (`.husky/`, a lint-staged config), and whether the JS/TS rules (`.claude/rules/node-*.md`) and the test gate (`enforce-tests.mjs` in `hooks.Stop`) are already installed.
   - Any other stack is recorded as "other" by name (for example Python or Go).
3. List which of these already exist: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*`, `.github/instructions/*`, `.github/hooks/*`, `docs/backlog/backlog.md`.
4. Read the default team roster: for each `${CLAUDE_SKILL_DIR}/../../agents/*.md` (the plugin's `agents/` folder), the agent ID (file name) and the name in its `Persona name: **<Name>**` line. Overlay any existing `.claude/agent-memory/<agent>/user_persona-name.md` so a re-run shows the current names.

## Phase 1 — Confirm (one message)

Show the user a table of files to **create**, files that **exist** (will be diffed, not overwritten) and the values you detected:

- Detected stacks (.NET, JavaScript / TypeScript, both, or other), and for JS/TS: the package manager, monorepo / workspaces, TypeScript or JavaScript, and the test runner
- Product name (from the solution file name, else the root `package.json` `name`, else the repository folder name)
- Build / test / mutation commands, one set per detected stack. Always confirm them with the user; never install them unconfirmed.
  - .NET defaults: `dotnet build`, `dotnet test`, `dotnet stryker`.
  - JS/TS defaults, from the `package.json` scripts and the package manager (`<pm>`): build = `<pm> run build` if a `build` script exists, else `tsc --noEmit` for TypeScript (none for plain JavaScript); test = `<pm> test` (`bun run test` for bun; in a monorepo, the root script or the manager's run-in-every-workspace form); mutation = `npx stryker run` (pnpm: `pnpm exec stryker run`, bun: `bunx stryker run`).
  - Other stacks: ask.
- Per supported stack: the rules and test gate hook that will be installed, and what the gate will run (.NET: the test solution, a `*.Testing.slnx` / `*.Tests.sln` if present; JS/TS: the confirmed test command and folder)
- JS/TS only: the Stryker test runner (`vitest` → `vitest`, `jest` → `jest`, `mocha` → `mocha`, `node:test` → `tap`, else `command`), and whether to offer the optional pre-commit hook from `node-rules`
- Mutation break threshold (default 60)
- Team names: a table agent ID → current name (default, or the name chosen at an earlier init). Ask whether to rename any agents; the developer replies with `agent → new name` pairs, or "keep". Validate:
  - names are unique across the team (case-insensitive) and never equal an agent ID or a role alias (the ID with spaces, or a short form in the role-alias table under "Addressing agents by name or role" in `${CLAUDE_SKILL_DIR}/../../agents/orchestrator.md`, e.g. "architect", "QA");
  - `product-owner`, `product-manager` and `requirement-analyst` share one default name, so addressing that name is ambiguous — suggest distinct names, but do not force them.

Stack-specific rules, the automatic test gate and the Stryker config exist for .NET and JavaScript / TypeScript. For any other stack, say that they are not available for that stack yet and will be skipped; the stack-neutral files (AGENTS.md, CLAUDE.md, settings, docs) are still written.

Ask once for corrections, then proceed.

## Phase 2 — Write

For each template, replace the `{{PLACEHOLDERS}}` and write it. For a file that already exists, show a unified diff of the proposed merge and write only after the user agrees.

| Template | Destination |
|---|---|
| `templates/AGENTS.md` | `AGENTS.md` — the **orchestrator persona** for this project (the full **Scott Hanselman** (`orchestrator`) agent definition, its routing rules and skills) followed by the project's commands, gates, artifact locations and conventions. Fill every `{{PLACEHOLDER}}`; do not edit the persona sections. If an `AGENTS.md` exists, keep its project-specific notes and show the diff. |
| `templates/CLAUDE.md` | `CLAUDE.md` (or `.claude/CLAUDE.md` if the repo already keeps it there) |
| `templates/settings.json` | `.claude/settings.json` — **merge** `agent`, `permissions` and `env` keys into any existing file; never drop existing entries. Keep only the `permissions.allow` entries for the detected stacks: `Bash(dotnet …)` for .NET; `Bash(node …)`, `Bash(npx …)` and the entries of the detected package manager (`npm` / `pnpm` / `yarn` / `bun`) for JS/TS. Keep the `git` entries and `deny` always. |
| `templates/stryker-config.json` | test project folder (.NET only, and only if no Stryker.NET config exists) |
| `templates/stryker.config.json` | the folder whose `package.json` runs the confirmed test command, usually the repository root (JS/TS only, and only if no StrykerJS config exists) — see the JS/TS steps below |
| `templates/docs/backlog.md` | `docs/backlog/backlog.md` |

In a repository with both stacks, fill each command placeholder in `AGENTS.md` and `CLAUDE.md` once per stack: one table row or list line per stack, labelled (for example "Test (.NET)" and "Test (JS/TS)").

Also create empty folders with a `.gitkeep`: `docs/specs/`, `docs/architecture/decisions/`, `docs/architecture/narratives/`, `docs/plans/`, `docs/handoffs/`, `docs/product/`.

**.NET projects only:**

- Install the rules: read `${CLAUDE_SKILL_DIR}/../dotnet-rules/SKILL.md` and follow its **Install** section, passing the build / test / mutation commands confirmed in Phase 1. It writes the C# coding-style, GlobalUsings and testing rules to `.claude/rules/` and their twins to `.github/instructions/`.
- Install the test gate: read `${CLAUDE_SKILL_DIR}/../dotnet-test-gate/SKILL.md` and follow its **Install** section (both skills are user-invocable only, so read them rather than calling them). It copies `enforce-tests.ps1` to `.claude/hooks/`, merges the `Stop` hook into `.claude/settings.json` and writes `.github/hooks/ai-dlc-test-gate.json` for Copilot. Skip it if the gate is already installed and identical.
- If there is no local tool manifest, offer (do not run without consent): `dotnet new tool-manifest && dotnet tool install dotnet-stryker`.

**JavaScript / TypeScript projects only:**

- Install the rules: read `${CLAUDE_SKILL_DIR}/../node-rules/SKILL.md` and follow its **Install** section, passing the test / mutation commands confirmed in Phase 1. It writes the coding-style, modules, async / error-handling and testing rules to `.claude/rules/node-*.md` and their twins to `.github/instructions/`, then offers the optional pre-commit hook (Husky + lint-staged); follow its consent and skip rules.
- Install the test gate: read `${CLAUDE_SKILL_DIR}/../node-test-gate/SKILL.md` and follow its **Install** section, passing the confirmed test command and folder. It copies `enforce-tests.mjs` to `.claude/hooks/`, merges the `Stop` hook into `.claude/settings.json` and writes `.github/hooks/ai-dlc-node-test-gate.json` for Copilot. Skip it if the gate is already installed and identical.
- Stryker config, only if no StrykerJS config exists: write `templates/stryker.config.json`, replacing `{{STRYKER_TEST_RUNNER}}` with the runner from Phase 1, `{{SOURCE_ROOT}}` with the source root (`src`, `lib`; in a monorepo, a `{a,b}` glob over the packages, for example `packages/*/src`) and `{{MUTATION_BREAK}}`. For the `command` runner, also set `"commandRunner": { "command": "<confirmed test command>" }` and remove `coverageAnalysis`. Then offer (do not run without consent) to install the dev dependencies with the detected package manager: `@stryker-mutator/core` plus the runner plugin (`@stryker-mutator/vitest-runner`, `jest-runner`, `mocha-runner` or `tap-runner`; none for `command`). Suggest adding `reports/` to `.gitignore` unless the incremental file should be committed or cached in CI.

**Team names** (memory format from `manage-memory`):

- For each renamed agent, write `.claude/agent-memory/<agent>/user_persona-name.md`:

  ```markdown
  ---
  name: persona-name
  description: The name this agent answers to in this repository
  type: user
  ---

  Your name in this repository is **<Name>** (chosen by the developer at init; replaces the default persona name <Default>). Answer to it, and sign your reports with it.

  **Why:** the developer named the team at `/ai-dlc:init`.
  **How to apply:** use this name in place of your default `Persona name`; renames go through `init` or `agent-manager`, never through the agent itself.
  ```

  Add or update its line in that agent's `MEMORY.md` index (create the index if missing).
- Always (renamed or not) write `.claude/agent-memory/orchestrator/project_team-roster.md` (type `project`, name `team-roster`) with the full table agent ID → name (chosen or default), a note that every agent stays addressable by its role too (agent ID or role alias, see the orchestrator's "Addressing agents by name or role"), a **Why:** and a **How to apply:** line, and add or update its line in the orchestrator's `MEMORY.md`.
- Existing memory files follow the same rule as every other file: diff, then consent.

## Phase 3 — Report

List every file created or changed and the team roster (agent ID → name), then the next step:

> The orchestrator is now the default agent for this repo (`"agent": "ai-dlc:orchestrator"` in `.claude/settings.json`), so every request reaches it first. One-off alternative: `claude --agent ai-dlc:orchestrator`. On Copilot, select the `orchestrator` custom agent.

## Rules

- Never overwrite without a diff and consent. Never touch `.env` files.
- Keep rules and their Copilot twins identical in body; only frontmatter differs (`paths` vs `applyTo`).
