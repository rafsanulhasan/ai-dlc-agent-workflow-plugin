---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 2
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 2 orchestrator → research-assistant: list every setting cache-keepalive uses

Written after the fact: the spawn happened in plan mode. The brief below is the one that was sent.

## Goal
The human wants every setting the mod uses to be configurable through env vars and a repository file, so the plan needs the full list.

## Artifacts
- `plugins/claude-mods/cache-keepalive/` and `plugins/claude/ai-dlc/hooks/auto-handoff/` — exist

## Instructions for the receiver
Read-only. List, each with its name, default, path:line and what it controls:
- every userConfig key;
- every override set by the slash command;
- every hard-coded constant that changes behaviour.

Also give auto-handoff's env var naming convention. One item per line.
