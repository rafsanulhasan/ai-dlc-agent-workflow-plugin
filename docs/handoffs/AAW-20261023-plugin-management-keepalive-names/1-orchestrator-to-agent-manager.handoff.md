---
from: orchestrator
to: agent-manager
step: 1
run: AAW-20261023-plugin-management-keepalive-names
---
# Handoff: update plugin-management for the renamed keep-alive skills
- In run AAW-20261022-cache-keepalive-init, the plugin skill `keepalive` was renamed to `cache-keepalive` (command `/ai-dlc:cache-keepalive`), and a new Claude-only skill `cache-keepalive-config` was added. Both are listed in tools/claude-only-skills.json.
- plugins/claude/ai-dlc/skills/plugin-management/SKILL.md:39 and :95 still name `keepalive`. Update every mention in plugin-management, including its templates and references, to the new names. Change nothing else.
- Note: keep-alive no longer has /config rows. If plugin-management says it does, correct that too.
- Run `node tools/build-copilot.mjs` and `--check`. Do not commit.
- Another agent-manager is working in parallel on other files in the same tree (keep-alive and auto-handoff). Touch only plugin-management.
Return: line 1 `handoff <this file>: passed|failed — <why>`, then the changed paths marked code/docs, then the checks you ran.
