# Project: AI-DLC Agent Workflow

> Agent-related instructions (routing, anti-hallucination, memory, file ownership, multi-platform portability) live in [AGENTS.md](../AGENTS.md).

A Claude Code and GitHub Copilot plugin that ships the AI-DLC agentic engineering team. The lifecycle, agents and gates are language-agnostic; .NET is the first supported stack, with more languages to follow.

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
- Stack-specific rules and hooks (e.g. `dotnet-rules`, `dotnet-test-gate`) are installed into target repositories by skills that `/ai-dlc:init` runs; the plugin itself ships no hooks or rules.
- `.claude/rules/plugin-development.md` — the workflow rule for this repository.

## Watch out for

- After changing anything under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`. A Stop hook (`.claude/hooks/check-copilot-stale.mjs`) blocks finishing while the Copilot plugin is stale.
- CI (`.github/workflows/validate.yml`) runs the staleness check and both `plugin validate --strict` commands.
