---
name: dotnet-test-gate
description: "Installs the AI-DLC .NET test gate into the current repository: a Claude Code Stop hook and a GitHub Copilot agentStop hook that block the agent from finishing while `dotnet test` fails after runtime changes. Called by init when it detects a .NET project; run it directly to add, repair or remove the gate. Only for repositories that contain a .sln, .slnx or .csproj."
disable-model-invocation: true
---

# .NET test gate

The gate is a project hook, not a plugin hook: it is installed only into repositories that are .NET projects, so other stacks never run it. The files it installs come from `${CLAUDE_SKILL_DIR}/templates/`.

## When to use

- `init` calls this skill when Phase 0 finds a `*.sln`, `*.slnx` or `*.csproj` (outside `bin/`, `obj/`, `node_modules/`).
- The user asks to add, repair, reconfigure or remove the test gate.

If the repository has no .NET project file, stop and say so — do not install the gate.

## What the gate does

`enforce-tests.ps1` runs when the agent stops (Claude `Stop`, Copilot `agentStop`). It runs `dotnet test` and returns `{"decision":"block","reason":…}` with the last 40 lines of output while tests fail. It stays silent when:

- the repo has no `.sln`/`.slnx`/`.csproj`, or `dotnet` is not on PATH;
- nothing changed, or only artifacts changed (`.claude/`, `.github/agents|skills|prompts|instructions|hooks/`, `docs/`, `AGENTS.md`, `CLAUDE.md`, `*.md`);
- the hook already blocked once in this stop cycle (`stop_hook_active` loop guard);
- `AI_DLC_ENFORCE_TESTS` is `false`, `0`, `no` or `off`.

Test target: `AI_DLC_TEST_TARGET`, else a `*.Testing.slnx` / `*.Tests.sln(x)` at the repo root, else `dotnet test` in the repo root.

Requires PowerShell 7 (`pwsh`) on PATH on every OS.

## Install

1. Confirm the repository is a .NET project (see above) and that `pwsh` is available. If `pwsh` is missing, tell the user and stop.
2. Copy `templates/enforce-tests.ps1` to `.claude/hooks/enforce-tests.ps1`. If the file exists and differs, show a diff and write only with consent.
3. **Claude Code:** merge `templates/claude-hook.json` into `.claude/settings.json` — append the `Stop` entry to any existing `hooks.Stop` array; never drop existing hooks, and do not add it twice (match on `enforce-tests.ps1` in the command).
4. **GitHub Copilot:** write `templates/copilot-hook.json` to `.github/hooks/ai-dlc-test-gate.json` (create `.github/hooks/` if needed). Both platforms run the single script in `.claude/hooks/`.
5. If the detected test solution is not the default pick, offer to set it: add `"AI_DLC_TEST_TARGET": "<sln>"` under `env` in `.claude/settings.json` (Copilot reads the same variable from the shell environment).

## Remove

Delete the `enforce-tests.ps1` entry from `hooks.Stop` in `.claude/settings.json`, delete `.github/hooks/ai-dlc-test-gate.json`, and delete `.claude/hooks/enforce-tests.ps1` — after showing the user what will be removed. To pause the gate without removing it, set `AI_DLC_ENFORCE_TESTS=false`.

## Report

List each file created or changed, the test target the gate will use, and how to disable it.
