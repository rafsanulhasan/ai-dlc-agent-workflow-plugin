---
name: mods-release-scope
description: 2026-10-20 human decision — 1.0.0 ships the ai-dlc mods (Claude), hook-based mods also for Copilot; one mods plugin grown from ai-dlc-lens
metadata:
  type: project
---

On 2026-10-20 the human decided that release 1.0.0 ships the AI-DLC mods for Claude Code. Mods that run only through settings hooks are also integrated for Copilot. Packaging is ai-dlc core (AAW changes) plus **one** Claude-only mods plugin, grown out of the ai-dlc-lens run. This replaces that run's earlier "buy, don't build" decisions and its rule to ship in 1.1.0 if the work would delay 1.0.0.

**Why:** the user wants the mods to be part of the first release, not a follow-up.

**How to apply:** treat the mods scope as blocking 1.0.0. Fix the build-copilot multi-plugin error first, because a second plugin under `plugins/claude/` breaks CI. Related: [[vscode-plugin-reload]].

Tooling note: background subagents' `tasks/*.output` files can be empty. Hand-backs can be extracted verbatim from `~/.claude/projects/<proj>/<session>/subagents/agent-<id>.jsonl`, using the last assistant text.
