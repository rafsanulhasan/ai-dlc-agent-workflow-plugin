---
description: Plugin development workflow for AI-DLC Agent Workflow
alwaysApply: true
---

# Plugin Development

- `plugins/claude/ai-dlc/` is the source of truth. Make every agent, skill or manifest change there.
- Never hand-edit `plugins/copilot/**`. After any change under `plugins/claude/ai-dlc/`, run `node tools/build-copilot.mjs`, then confirm `node tools/build-copilot.mjs --check` passes. A Stop hook blocks finishing while it is stale.
- After changing a manifest (`plugin.json`, `marketplace.json`) or adding/removing an agent or skill, run both validations:
  - `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`
  - `npx @anthropic-ai/claude-code plugin validate --strict .`
- Keep agents and generic skills language-agnostic. Stack-specific content (C#, `dotnet`, NuGet, Stryker.NET) belongs in stack-specific skills; stack-specific rules and hooks are installed into target repositories by skills that `/ai-dlc:init` runs (e.g. `dotnet-rules`, `dotnet-test-gate`), never shipped as plugin-wide hooks.
- Plugin skills that `init` follows are `disable-model-invocation: true`; `init` reads their `SKILL.md` via `${CLAUDE_SKILL_DIR}/../<skill>/SKILL.md` instead of calling them.
