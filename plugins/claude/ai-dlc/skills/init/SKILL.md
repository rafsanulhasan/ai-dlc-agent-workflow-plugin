---
name: init
description: "Bootstraps a repository for the AI-DLC agent team: scaffolds AGENTS.md (the orchestrator persona with all its skills, plus the project's gates and workspace folders, free of stack-specific commands), CLAUDE.md (an @AGENTS.md import, the project's build / test / mutation commands and the Claude Code specifics), .github/copilot-instructions.md (the same commands and the GitHub Copilot specifics), recommended .claude/settings.json permissions and the docs/ skeleton the lifecycles write to; sets the worktree root and the gitignored scratch root via workspace-folders; installs the two-way Claude Code ↔ GitHub Copilot harness sync script (.claude/scripts/sync-harness.mjs); installs the team's customisable workflow (.ai-dlc/workflow.json with its schema, the workflow.mjs CLI, a catalog of the installed plugin's agents and skills, and a Stop-hook gate that blocks finishing while the file is invalid), which the orchestrator follows instead of the plugin default; and lets the developer name the agent team (each renamed agent remembers its name; the orchestrator keeps the roster). For each supported stack it detects it also installs the stack's coding and testing rules with their Copilot twins, a test gate hook and a Stryker config: .NET via dotnet-rules and dotnet-test-gate, JavaScript / TypeScript (Node.js) via node-rules and node-test-gate. A repository with both stacks gets both. Use once per repository, to repair a partial setup, or to refresh after a plugin update. An existing AGENTS.md or CLAUDE.md is merged, not replaced: init owns only its marked blocks. Never overwrites existing files without showing a diff first."
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
3. Existing `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` (any case; `CLAUDE.md` also in `.claude/`; note `CLAUDE.local.md` and never touch it): follow "Inspect an existing file" in [references/managed-blocks.md](references/managed-blocks.md). Reuse the commands and notes they state as Phase 1 defaults.
4. List which of these already exist: `.claude/settings.json`, `.claude/rules/*`, `.github/instructions/*`, `.github/hooks/*`, `.claude/scripts/sync-harness.mjs`, `.ai-dlc/workflow.json`, `.ai-dlc/workflow.schema.json`, `.ai-dlc/workflow.mjs`, `.ai-dlc/catalog.json`, `.claude/hooks/check-workflow.mjs`, `docs/backlog/backlog.md`. For an existing `.ai-dlc/workflow.json`, record whether `node .ai-dlc/workflow.mjs validate` passes and how it differs from `${CLAUDE_SKILL_DIR}/../workflow/templates/workflow.json` (`diff --against`).
5. Workspace folders: read `${CLAUDE_SKILL_DIR}/../workspace-folders/SKILL.md` and follow its **Inspect** section (roots from an earlier init, `.gitignore`, existing worktrees, worktree hooks). It runs even when `AGENTS.md` does not exist yet; then the mode is create.
6. Read the default team roster: for each `${CLAUDE_SKILL_DIR}/../../agents/*.md` (the plugin's `agents/` folder), the agent ID (file name) and the name in its `Persona name: **<Name>**` line. Overlay any existing `.claude/agent-memory/ai-dlc-<agent>/user_persona-name.md` so a re-run shows the current names. Each agent has one memory folder, named by the "Memory folder" rule of `${CLAUDE_SKILL_DIR}/../manage-memory/SKILL.md`: `ai-dlc-<agent>` for a plugin agent. Also record any folder an earlier init wrote under the bare agent ID (`.claude/agent-memory/<agent>/` for a plugin agent ID, such as `orchestrator/`), and read its `user_persona-name.md` too when the `ai-dlc-<agent>` folder has none.
7. Agent memory is committed with the repository. Check that nothing ignores it: `git check-ignore -v .claude/agent-memory/ai-dlc-orchestrator/MEMORY.md` (the file need not exist).
   - Exit 1: it is tracked.
   - Exit 0: a rule ignores it. Record the source file, line and pattern it prints: a `.gitignore` at the root or in a subfolder, `.git/info/exclude`, or the developer's global excludes file.
   - Exit 128: this is not a git repository. Skip the check and say so in the Phase 3 report.

## Phase 1 — Confirm (one message)

Show the user a table of files to **create**, files to **merge** (an existing `AGENTS.md`, `CLAUDE.md` or `.github/copilot-instructions.md`: any rename, or the move of `.claude/CLAUDE.md` to the root, from "Location and name"; each managed block as add / update / skip / remove, and each section of theirs that is reused — the "Decide per block" step of [references/managed-blocks.md](references/managed-blocks.md)), other files that **exist** (diffed, not overwritten) and the values you detected:

- Detected stacks (.NET, JavaScript / TypeScript, both, or other), and for JS/TS: the package manager, monorepo / workspaces, TypeScript or JavaScript, and the test runner
- Product name (from the solution file name, else the root `package.json` `name`, else the repository folder name)
- Build / test / mutation commands, one set per detected stack. Always confirm them with the user; never install them unconfirmed. Commands an existing `CLAUDE.md`, `.github/copilot-instructions.md` or `AGENTS.md` (an older init wrote them there) already states are the defaults; list every one that conflicts with a detected value and ask which to use.
  - .NET defaults: `dotnet build`, `dotnet test`, `dotnet stryker`.
  - JS/TS defaults, from the `package.json` scripts and the package manager (`<pm>`): build = `<pm> run build` if a `build` script exists, else `tsc --noEmit` for TypeScript (none for plain JavaScript); test = `<pm> test` (`bun run test` for bun; in a monorepo, the root script or the manager's run-in-every-workspace form); mutation = `npx stryker run` (pnpm: `pnpm exec stryker run`, bun: `bunx stryker run`).
  - Other stacks: ask.
- Per supported stack: the rules and test gate hook that will be installed, and what the gate will run (.NET: the test solution, a `*.Testing.slnx` / `*.Tests.sln` if present; JS/TS: the confirmed test command and folder)
- JS/TS only: the Stryker test runner (`vitest` → `vitest`, `jest` → `jest`, `mocha` → `mocha`, `node:test` → `tap`, else `command`), and whether to offer the optional pre-commit hook from `node-rules`
- Mutation break threshold (default 60)
- Team workflow: `.ai-dlc/workflow.json` is created from the plugin default, or — when one exists — kept, with its `diff --against` the default and its `validate` result listed; `.ai-dlc/catalog.json` is generated from the installed plugin; the workflow gate hook is installed. Customising the workflow comes later, with `/ai-dlc:workflow edit`
- Workspace folders: the worktree root and scratch root, validated, with the `.gitignore` lines and hook entries — the **Confirm** section of `workspace-folders`, inside this same message
- Agent memory: `.claude/agent-memory/` is committed with the repository and shared with everyone who clones it, so it must never hold secrets or personal data (`manage-memory`, "Committed with the repository"). When Phase 0 found a rule that ignores it, show its file, line and pattern, describe the change "Agent memory" in Phase 2 would make, and ask a separate yes / no question: "Change the ignore rules so agent memory is committed?". Only an explicit yes applies it; anything else, silence included, means no change and the rule is listed in the Phase 3 report.
- Memory folders from an earlier init (Phase 0, step 6): list each `<agent>/` folder and the `ai-dlc-<agent>/` folder its files move into.
- Team names: a table agent ID → current name (default, or the name chosen at an earlier init). Ask whether to rename any agents; the developer replies with `agent → new name` pairs, or "keep". Validate:
  - names are unique across the team (case-insensitive) and never equal an agent ID or a role alias (the ID with spaces, or a short form in the role-alias table under "Addressing agents by name or role" in `${CLAUDE_SKILL_DIR}/../../agents/orchestrator.md`, e.g. "architect", "QA");
  - `product-owner`, `product-manager` and `requirement-analyst` share one default name, so addressing that name is ambiguous — suggest distinct names, but do not force them.

Stack-specific rules, the automatic test gate and the Stryker config exist for .NET and JavaScript / TypeScript. For any other stack, say that they are not available for that stack yet and will be skipped; the stack-neutral files (AGENTS.md, CLAUDE.md, settings, docs) are still written.

Ask once for corrections, then proceed.

## Phase 2 — Write

For each template, replace the `{{PLACEHOLDERS}}` and write it. For a file that already exists, show a unified diff of the proposed merge and write only after the user agrees.

| Template | Destination |
|---|---|
| `templates/AGENTS.md` | `AGENTS.md` — the **orchestrator persona** for this project (the full **Scott Hanselman** (`orchestrator`) agent definition, its routing rules and skills) with the project's gates, artifact locations and conventions. It holds no stack-specific command. Fill every `{{PLACEHOLDER}}`; do not edit the persona. An existing file is **merged**, not replaced (below). |
| `templates/CLAUDE.md` | `CLAUDE.md` in the repository root, next to `AGENTS.md`: the `@AGENTS.md` import, the project's build / test / mutation commands (`commands` block) and the Claude Code specifics. An existing file is **merged**; a `.claude/CLAUDE.md` is moved or merged into it (below) |
| `templates/copilot-instructions.md` | `.github/copilot-instructions.md` — the repository-level GitHub Copilot instructions: the same `commands` block and the Copilot specifics (Copilot also loads `AGENTS.md` itself). An existing file is **merged** (below). Both templates are rendered from one source, so they carry the same managed blocks with per-platform content |
| `templates/settings.json` | `.claude/settings.json` — **merge** `agent`, `permissions` and `env` keys into any existing file; never drop existing entries. Keep only the `permissions.allow` entries for the detected stacks: `Bash(dotnet …)` for .NET; `Bash(node …)`, `Bash(npx …)` and the entries of the detected package manager (`npm` / `pnpm` / `yarn` / `bun`) for JS/TS. Keep the `git` entries and `deny` always. |
| `templates/stryker-config.json` | test project folder (.NET only, and only if no Stryker.NET config exists) |
| `templates/stryker.config.json` | the folder whose `package.json` runs the confirmed test command, usually the repository root (JS/TS only, and only if no StrykerJS config exists) — see the JS/TS steps below |
| `templates/docs/backlog.md` | `docs/backlog/backlog.md` |

**Workspace folders** (every stack): fill `{{WORKTREE_ROOT}}` and `{{SCRATCHPAD_ROOT}}` in `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md` with the roots confirmed in Phase 1, then follow the **Write** section of `${CLAUDE_SKILL_DIR}/../workspace-folders/SKILL.md` (`.gitignore`, the Claude worktree hooks and `.claude/settings.json`).

**Existing `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md`:** follow "Location and name", "Place a new block", "Write" and, for files from an earlier init without markers, "Convert legacy content" in [references/managed-blocks.md](references/managed-blocks.md). Only the content between `<!-- ai-dlc:begin <id> -->` / `<!-- ai-dlc:end <id> -->` markers is init's; every other line of the developer's file stays as it was. Done when the merged file keeps every developer line in order and the markers are balanced.

**Project commands** (every stack): fill `{{BUILD_CMD}}`, `{{TEST_CMD}}` and `{{MUTATION_CMD}}` in the `commands` block of `CLAUDE.md` and of `.github/copilot-instructions.md` with the commands confirmed in Phase 1, the same values in both files; a stack without one gets "none" and the reason. Never write a stack-specific command into `AGENTS.md`. In a repository with both stacks, fill each placeholder once per stack: one table row per stack, labelled (for example "Test (.NET)" and "Test (JS/TS)").

**Harness sync script** (every stack): copy `${CLAUDE_SKILL_DIR}/../harness-sync/templates/sync-harness.mjs` to `.claude/scripts/sync-harness.mjs`; an existing different copy is diffed first, like every other file. Run it last, after every other file in this phase is written, with `node .claude/scripts/sync-harness.mjs --check`, and report its output in Phase 3. Done when it exits 0, or when every line it prints is in the report. Developers run it themselves after hand-made changes; `/ai-dlc:harness-sync install` installs or refreshes it later.

**Team workflow** (every stack): read `${CLAUDE_SKILL_DIR}/../workflow/SKILL.md` and follow its **Mode: install** steps:

1. Copy `workflow.json`, `workflow.schema.json` and `workflow.mjs` from `${CLAUDE_SKILL_DIR}/../workflow/templates/` to `.ai-dlc/`. An existing different file is diffed first, like every other file; an existing `workflow.json` holds the team's customisations, so offer `/ai-dlc:workflow upgrade` instead of replacing it.
2. Generate the catalog: `node .ai-dlc/workflow.mjs catalog --plugin ${CLAUDE_SKILL_DIR}/../..` writes `.ai-dlc/catalog.json` (the plugin version, its agent IDs and skill names). Regenerate it on every re-run, so it matches the installed plugin.
3. Install the workflow gate: `.claude/hooks/check-workflow.mjs`, its `Stop` entry merged into `.claude/settings.json`, and `.github/hooks/ai-dlc-workflow-gate.json` for Copilot.
4. Run `node .ai-dlc/workflow.mjs validate`. Done when it exits 0, or when every error is in the Phase 3 report.

**Agent memory** (every stack): never add a rule that ignores `.claude/agent-memory/`. Only when the developer answered yes in Phase 1, change the ignore rules. Keep a copy of every file you edit, then repeat these steps until `git check-ignore -v .claude/agent-memory/ai-dlc-orchestrator/MEMORY.md` exits 1, at most three times:

1. Take the source file and pattern `check-ignore -v` prints.
2. Create `.claude/agent-memory/` if it is missing, then run `git check-ignore -v .claude` (no trailing slash: with one, a pattern such as `.claude/*` also matches). When it exits 0 and names that same pattern, the pattern ignores the `.claude` folder itself, whatever its form (`.claude`, `/.claude/`, `**/.claude/`, …), and git cannot re-include anything inside an ignored folder. Rewrite that line so it ignores the folder's children instead, ending in `/*` (`.claude` → `.claude/*`, `/.claude/` → `/.claude/*`, `**/.claude/` → `**/.claude/*`). Do not rewrite it, but stop and report its file and line, when it is outside the repository or also matches other names (a wildcard such as `.*`).
3. When the source file is outside the repository (`.git/info/exclude`, the global excludes file), never edit it: add the negation lines of step 5 to the root `.gitignore`, which takes precedence over both.
4. When the pattern names only agent memory (`.claude/agent-memory/`, `agent-memory/`) in a repository `.gitignore`, delete that line.
5. Otherwise add two negation lines at the end of the file `check-ignore -v` named, written relative to that file's folder: `!.claude/agent-memory/` and `!.claude/agent-memory/**` in the root `.gitignore`, `!agent-memory/` and `!agent-memory/**` in `.claude/.gitignore`. Both lines are needed: the second re-includes files that a pattern such as `*.md` or `.claude/**` matches. A negation in the root file does not override a rule in a deeper `.gitignore`, so it goes in the root file only when the rule is there or outside the repository.

Done when `check-ignore` exits 1. If step 2 stops, or `check-ignore` still exits 0 after the third round, restore every file you edited from its copy and list the remaining rule in the Phase 3 report. When the developer answered no, the rule goes in the report unchanged.

**Memory folders from an earlier init** (every stack): for each `<agent>/` folder listed in Phase 1, move its files into `.claude/agent-memory/ai-dlc-<agent>/` and merge its `MEMORY.md` lines into that folder's index, one line per memory. A file whose name already exists there is diffed first and merged with consent. Remove the old folder once it is empty.

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

- For each renamed agent, write `.claude/agent-memory/ai-dlc-<agent>/user_persona-name.md`:

  ```markdown
  ---
  name: persona-name
  description: The name this agent answers to in this repository
  metadata:
    type: user
  ---

  Your name in this repository is **<Name>** (chosen by the developer at init; replaces the default persona name <Default>). Answer to it, and sign your reports with it.

  **Why:** the developer named the team at `/ai-dlc:init`.
  **How to apply:** use this name in place of your default `Persona name`; renames go through `init` or `agent-manager`, never through the agent itself.
  ```

  Add or update its line in that agent's `MEMORY.md` index (create the index if missing).
- Always (renamed or not) write `.claude/agent-memory/ai-dlc-orchestrator/project_team-roster.md` (name `team-roster`, `metadata.type: project`, the memory file format of `manage-memory`) with the full table agent ID → name (chosen or default), a note that every agent stays addressable by its role too (agent ID or role alias, see the orchestrator's "Addressing agents by name or role"), a **Why:** and a **How to apply:** line, and add or update its line in the orchestrator's `MEMORY.md`.
- Existing memory files follow the same rule as every other file: diff, then consent.

## Phase 3 — Report

List every file created or changed, the items of the `workspace-folders` **Report**, the team roster (agent ID → name), whether agent memory is tracked (any ignore rule left in place, with its file and line, or "not a git repository"), and each memory folder moved. Say that `.claude/agent-memory/` is committed with the repository, so the team shares what the agents learn, and that memory files must be checked for secrets and personal data before each commit. Say that `/ai-dlc:workspace-folders` changes the roots later, that `node .claude/scripts/sync-harness.mjs` syncs agents, skills, commands, rules and hooks made on either platform to the other (`--check` only reports), and that the team's workflow — stages, who hands off to whom, gates and approvers, clarify matrix, routing — is in `.ai-dlc/workflow.json`, checked against `.ai-dlc/catalog.json` and guarded by the workflow gate: `/ai-dlc:workflow show` prints it with diagrams and `/ai-dlc:workflow edit <change>` changes it. Then the next step:

> The orchestrator is now the default agent for this repo (`"agent": "ai-dlc:orchestrator"` in `.claude/settings.json`), so every request reaches it first. One-off alternative: `claude --agent ai-dlc:orchestrator`. On Copilot, select the `orchestrator` custom agent.

## Rules

- Never overwrite without a diff and consent. Never touch `.env` files or `CLAUDE.local.md`.
- In `AGENTS.md`, `CLAUDE.md` and `.github/copilot-instructions.md`, change only managed blocks; the developer's own content outside them is preserved line for line.
- Keep rules and their Copilot twins identical in body; only frontmatter differs (`paths` vs `applyTo`).
