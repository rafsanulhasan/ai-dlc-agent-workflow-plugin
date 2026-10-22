---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 3
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 3 orchestrator → research-assistant: list the slash commands of both modules

Written after the fact: the spawn happened in plan mode. The brief below is the one that was sent.

## Goal
The human wants every command to carry the `ai-dlc:` prefix, so it cannot clash with other plugins.

## Artifacts
- `plugins/claude/ai-dlc/hooks/auto-handoff/`, `plugins/claude-mods/cache-keepalive/`, `plugins/claude/ai-dlc/skills/` — exist

## Instructions for the receiver
Read-only. List every slash command the two modules register or mention, with:
- its arguments and where it is registered;
- every place that mentions it.

Then say, with evidence, whether a command registered by a hooks module is namespaced as `/<plugin>:<name>` or appears bare. One item per line.
