# Project: AI-DLC Agent Workflow

A Claude Code and GitHub Copilot plugin that ships the AI-DLC agentic engineering team. The lifecycle, agents and gates are language-agnostic; .NET and JS / TS (Node.js, TypeScript, JavaScript) are the supported stacks, with more languages to follow.

## Agents and skills in this repo

This repo has no local copies of agents, skills or commands; it runs the plugin it builds. Register the repo as a local marketplace once per machine (writes the machine path to the gitignored `.claude/settings.local.json`):

```text
claude plugin marketplace add ./ --scope local
claude plugin install ai-dlc@ai-dlc-agent-workflow --scope local
```

Agents are then `ai-dlc:<name>` and skills `/ai-dlc:<name>`, read straight from `plugins/claude/ai-dlc/`; edits apply on the next session or after `/reload-plugins`. Changes to agents, skills, hooks or rules go through `ai-dlc:agent-manager`.

## Commands

- `node tools/build-copilot.mjs` : regenerate `plugins/copilot/ai-dlc` from `plugins/claude/ai-dlc`
- `node tools/build-copilot.mjs --check` : fail if the Copilot plugin is stale
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` : validate the Claude plugin
- `npx @anthropic-ai/claude-code plugin validate --strict .` : validate the marketplace

## Architecture

- `plugins/claude/ai-dlc/` — source of truth (agents, skills)
- `plugins/copilot/ai-dlc/` — generated; never hand-edit
- `tools/build-copilot.mjs` — Claude → Copilot projection
- `.claude-plugin/marketplace.json`, `.github/plugin/marketplace.json` — marketplaces
- Stack-specific rules and hooks (`dotnet-rules` and `dotnet-test-gate` for .NET, `node-rules` and `node-test-gate` for JS / TS) are installed into target repositories by skills that `/ai-dlc:init` runs; the plugin itself ships no hooks or rules.
- `.claude/rules/plugin-development.md` — the workflow rule for this repository.
- `.claude/skills/` — generated mirrors of the plugin skills listed in `tools/project-skills.json` (currently `presentation-authoring`); edit the plugin copy, then rebuild.

## Watch out for

- After changing anything under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`. A Stop hook (`.claude/hooks/check-copilot-stale.mjs`) blocks finishing while the Copilot plugin is stale.
- CI (`.github/workflows/validate.yml`) runs the staleness check and both `plugin validate --strict` commands.
