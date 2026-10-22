---
name: mods-release-scope
description: 1.0.0 ships the ai-dlc mods (Claude) inside ai-dlc core — cache-keepalive folded into the auto-handoff module on 2026-10-23; no separate mods plugin for it
metadata:
  type: project
---

On 2026-10-20 the human decided that release 1.0.0 ships the AI-DLC mods for Claude Code, and that mods running only through settings hooks are also integrated for Copilot. The packaging plan then was ai-dlc core (AAW changes) plus **one** Claude-only mods plugin, grown out of the ai-dlc-lens run. That replaced the run's earlier "buy, don't build" decisions and its rule to ship in 1.1.0 if the work would delay 1.0.0.

**Update 2026-10-23 (run `AAW-20261022-fold-cache-keepalive`).** cache-keepalive now lives inside ai-dlc core, in `hooks/auto-handoff/keepalive/`. `plugins/claude-mods/`, the `ai-dlc` `dependencies` entry and its marketplace entry are gone. Claude-only skills are listed in `tools/claude-only-skills.json`. Any *other* mod from the ai-dlc-lens plan (for example a status line) has not been re-decided: ask before creating a separate mods plugin again.

**Why:** the human wants the mods in the first release, and wants one module to manage both context and cache.

**How to apply:**
- Treat the mods scope as blocking 1.0.0.
- New Claude-only mod code goes into the ai-dlc hooks module first.
- A second plugin under `plugins/claude/` still breaks the Copilot build, so fix that first if a separate plugin is ever needed.

Related: [[vscode-plugin-reload]], [[auto-handoff-decisions]].

Tooling note: background subagents' `tasks/*.output` files can be empty. Hand-backs can be extracted verbatim from `~/.claude/projects/<proj>/<session>/subagents/agent-<id>.jsonl`, using the last assistant text.
