---
name: node-test-gate
description: "Installs the AI-DLC JavaScript / TypeScript test gate into the current repository: a Claude Code Stop hook and a GitHub Copilot agentStop hook that block the agent from finishing while the repository's test command fails after runtime changes. Called by init when it detects a Node.js project; run it directly to add, repair or remove the gate. Only for repositories that contain a package.json."
disable-model-invocation: true
---

# JavaScript / TypeScript test gate

The gate is a project hook, not a plugin hook: it is installed only into repositories that are Node.js projects, so other stacks never run it. The files it installs come from `${CLAUDE_SKILL_DIR}/templates/`.

## When to use

- `init` calls this skill when Phase 0 finds a `package.json` at the repository root or in a workspace package (outside `node_modules/`).
- The user asks to add, repair, reconfigure or remove the test gate.

If the repository has no `package.json`, stop and say so: do not install the gate.

## What the gate does

`enforce-tests.mjs` is a dependency-free Node.js script (Node.js 18 or later; Windows, macOS and Linux). It runs when the agent stops (Claude `Stop`, Copilot `agentStop`). It runs the repository's test command and returns `{"decision":"block","reason":…}` with the last 40 lines of output while tests fail. It stays silent when:

- the repo has no `package.json` (searched four levels deep, skipping `node_modules/`);
- nothing changed, or only artifacts changed (`.claude/`, `.github/agents|skills|prompts|instructions|hooks/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `*.md`), or only .NET files changed (`*.cs`, `*.csproj`, `*.sln(x)`, `*.props`, `*.targets`, `*.razor` …), which the .NET gate covers in a repository with both stacks;
- the hook already blocked once in this stop cycle (`stop_hook_active` loop guard);
- `AI_DLC_ENFORCE_TESTS` is `false`, `0`, `no` or `off` (this also pauses the .NET gate);
- no test command is configured and `package.json` has no real `test` script.

Test command, first match wins: `AI_DLC_NODE_TEST_CMD`; the command confirmed at `init`, written into the script at install; else `<pm> test`, with the package manager detected by lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` or `bun.lock` → bun, else npm; bun runs `bun run test`).

Test folder, relative to the repository root: `AI_DLC_NODE_TEST_CWD`, else the folder written in at install, else the root. In a workspace (monorepo), keep the root and use a test command that runs every workspace (for example `pnpm -r test`, `npm test --workspaces`), unless `init` confirmed otherwise.

## Install

1. Confirm the repository is a Node.js project (see above) and that `node` is on PATH.
2. Copy `templates/enforce-tests.mjs` to `.claude/hooks/enforce-tests.mjs`, replacing `{{TEST_CMD}}` with the test command confirmed at `init` and `{{TEST_CWD}}` with the test folder relative to the repository root (`.` for the root). Run directly, ask the user for both. If the file exists and differs, show a diff and write only with consent.
3. **Claude Code:** merge `templates/claude-hook.json` into `.claude/settings.json`: append the `Stop` entry to any existing `hooks.Stop` array; never drop existing hooks, and do not add it twice (match on `enforce-tests.mjs` in the command). A .NET gate entry (`enforce-tests.ps1`) stays next to it.
4. **GitHub Copilot:** write `templates/copilot-hook.json` to `.github/hooks/ai-dlc-node-test-gate.json` (create `.github/hooks/` if needed). Both platforms run the single script in `.claude/hooks/`.

## Remove

Delete the `enforce-tests.mjs` entry from `hooks.Stop` in `.claude/settings.json`, delete `.github/hooks/ai-dlc-node-test-gate.json`, and delete `.claude/hooks/enforce-tests.mjs`, after showing the user what will be removed. To pause the gate without removing it, set `AI_DLC_ENFORCE_TESTS=false`.

## Report

List each file created or changed, the test command and folder the gate will use, and how to disable it.
