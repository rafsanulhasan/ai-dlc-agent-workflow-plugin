---
from: orchestrator
to: brutal-critique
step: 2
run: AAW-20261023-plugin-management-keepalive-names
---
# Handoff: critique the plugin-management update
Docs path: plugins/claude/ai-dlc/skills/plugin-management/SKILL.md (lines 39, 75, 95; see `git diff` of that file).
Intent: name the renamed keep-alive skills, cache-keepalive (command /ai-dlc:cache-keepalive) and cache-keepalive-config, instead of `keepalive`. Change nothing else.
Orchestrator check: `node tools/build-copilot.mjs --check` is up to date.
Out of scope: tools/build-copilot.mjs:300 comment (fixed in run AAW-20261022-cache-keepalive-init).
Return: line 1 `handoff <file>: passed|failed — <why>`, then PASS/REVISE, then findings `path:line — problem — fix`.
