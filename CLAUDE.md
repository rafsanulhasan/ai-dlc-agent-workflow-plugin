# Project: AI-DLC Agent Workflow

<!-- ai-dlc:begin pointer -->
@AGENTS.md

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md), imported above. Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`, so the import is what loads it here.
<!-- ai-dlc:end pointer -->

A Claude Code and GitHub Copilot plugin that ships the AI-DLC agentic engineering team. The lifecycle, agents and gates are language-agnostic; .NET and JS / TS (Node.js, TypeScript, JavaScript) are the supported stacks, with more languages to follow.

## Agents and skills in this repo

This repo has no local copies of agents, skills or commands; it runs the plugin it builds. Register the repo as a local marketplace once per machine (writes the machine path to the gitignored `.claude/settings.local.json`):

```text
claude plugin marketplace add ./ --scope local
claude plugin install ai-dlc@ai-dlc-agent-workflow --scope local
```

Agents are then `ai-dlc:<name>` and skills `/ai-dlc:<name>`, read straight from `plugins/claude/ai-dlc/`; edits apply on the next session or after `/reload-plugins`. Changes to agents, skills, hooks or rules go through `ai-dlc:agent-manager`.

<!-- ai-dlc:skip commands -->
## Commands

`AGENTS.md` and the agents call these "the project's build, test or mutation command": the build is the first two lines below, the test command is `node --test "tests/**/*.test.mjs"`, and no mutation testing is set up for this stack.

- `node tools/build-copilot.mjs` : regenerate `plugins/copilot/ai-dlc` from `plugins/claude/ai-dlc`
- `node tools/build-copilot.mjs --check` : fail if the Copilot plugin is stale
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` : validate the Claude plugin
- `npx @anthropic-ai/claude-code plugin validate --strict .` : validate the marketplace
- `node --test "tests/**/*.test.mjs"` : run the repository tests (`tests/workflow/`: the `workflow.mjs` CLI; `tests/build-copilot-*.test.mjs`: the Copilot build); run it after changing a script that has tests in `tests/`. Quote the glob. Don't run `node --test` bare (it can also pick up the TypeScript tests of the hooks module and the vendored mod, which need `claude plugin test`) or `node --test tests/` (fails on Node 24)
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` : run the tests of the plugin's hooks module (`hooks/auto-handoff/`, the automatic session handoff); run it after changing the module or its tests
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude-mods/<mod>` and `npx @anthropic-ai/claude-code plugin test ./plugins/claude-mods/<mod>` : validate and test a vendored mod

## Architecture

- `plugins/claude/ai-dlc/` — source of truth (agents, skills, and `hooks/auto-handoff/`: a Claude-only hooks module, the automatic path of the `handoff` skill's session handoff, adapted from alexknowshtml/claude-auto-handoff; `hooks/hooks.json` lists it under `modules` only, and its six settings are the manifest's `userConfig`)
- `plugins/copilot/ai-dlc/` — generated; never hand-edit
- `plugins/claude-mods/` — vendored third-party Claude Code mods (currently `cache-keepalive`), each its own plugin in the Claude marketplace and a `dependencies` entry of `ai-dlc`, so they install with it. Claude-only: kept out of `plugins/claude/` because the Copilot build expects one plugin there
- `tools/build-copilot.mjs` — Claude → Copilot projection
- `tools/overlays/non-claude/skills/` — skills only non-Claude plugins ship (currently `scratchpad`); the build adds them to the Copilot plugin, never to the Claude one
- `.claude-plugin/marketplace.json`, `.github/plugin/marketplace.json` — marketplaces
- Stack-specific rules and hooks (`dotnet-rules` and `dotnet-test-gate` for .NET, `node-rules` and `node-test-gate` for JS / TS) are installed into target repositories by skills that `/ai-dlc:init` runs; the plugin itself ships no settings hooks or rules (its hooks module and its mod dependency are Claude Code mods, never projected to Copilot).
- `.claude/rules/plugin-development.md` — the workflow rule for this repository.
- `.claude/skills/` — generated mirrors of the plugin skills listed in `tools/project-skills.json` (currently `presentation-authoring`); edit the plugin copy, then rebuild.

## Watch out for

- After changing anything under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`. A Stop hook (`.claude/hooks/check-copilot-stale.mjs`) blocks finishing while the Copilot plugin is stale.
- CI (`.github/workflows/validate.yml`) runs the staleness check, the repository tests, both `plugin validate --strict` commands, `plugin test` for `ai-dlc`'s hooks module, and `plugin validate --strict` plus `plugin test` for each vendored mod.
- The hooks module and its tests stay under `plugins/claude/ai-dlc/hooks/`, never in `skills/`, `agents/` or `scripts/`, which the build copies to Copilot (it fails when one is there). It keeps its upstream `LICENSE`; record every change to it in its `ATTRIBUTION.md`.
- Vendored mods keep their upstream `LICENSE` file. When you change one, bump it to a new upstream commit, or add a mod, update its `VENDORED.md` and `THIRD_PARTY_NOTICES.md`.

<!-- ai-dlc:begin workspace-folders -->
## Workspace folders (Claude Code only)

- Write scratch files to `.scratch/<session-or-task>/` instead of Claude Code's built-in per-session scratchpad directory or the system temp directory.
- `claude --worktree`, `EnterWorktree` and agents with `isolation: "worktree"` get their worktree under `.worktrees/` through the `WorktreeCreate` hook in `.claude/settings.json`. Claude Code keeps the worktrees it creates for subagents; remove each with `git worktree remove` once its branch is merged.
<!-- ai-dlc:end workspace-folders -->
