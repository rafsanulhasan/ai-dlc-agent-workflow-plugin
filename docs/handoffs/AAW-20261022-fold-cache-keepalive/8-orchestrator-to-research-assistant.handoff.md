---
run: AAW-20261022-fold-cache-keepalive
work-item: none
lifecycle: AAW
step: 8
from: orchestrator
to: research-assistant
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-23
---

# 8 orchestrator → research-assistant: which Claude Code surfaces record workspace trust?

Written just after the spawn; the brief below is the one that was sent.

## Goal
The critique `6.l1-brutal-critique-to-orchestrator.handback.md` asks the docs to say on which surfaces the folder never counts as trusted. That claim comes from agent-manager (`4.l1-agent-manager-to-orchestrator.handback.md`, new risk 1), which cited nothing. Get the fact before any doc states it.

## Artifacts
- `plugins/claude/ai-dlc/skills/configure-auto-handoff/SKILL.md` (*Workspace trust*)
- `plugins/claude/ai-dlc/hooks/auto-handoff/io.ts` (`trustGate`)

## Instructions for the receiver
Using the official Claude Code docs and repo evidence, say which surfaces record `hasTrustDialogAccepted` in `~/.claude.json`: the terminal CLI, the VS Code extension, JetBrains, the Agent SDK, headless `claude -p`, and desktop. Return a compressed research report:
- one finding per line, with its source;
- for each surface: records trust / never records / unknown.
