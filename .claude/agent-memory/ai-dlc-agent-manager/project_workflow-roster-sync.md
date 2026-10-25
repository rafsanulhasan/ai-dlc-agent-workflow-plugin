---
name: workflow-roster-sync
description: workflow.mjs has no hard-coded roster; it validates against a generated .ai-dlc/catalog.json, but the default workflow.json is still a hand transcription of the ai-dlc prose
metadata:
  type: project
---

Since 2026-10-14 `skills/workflow/templates/workflow.mjs` has no `PLUGIN_AGENTS` list: `catalog --plugin <root>` writes `.ai-dlc/catalog.json` (plugin version, agent IDs, skill names) at workflow install / upgrade and init, and `validate --plugin plugins/claude/ai-dlc` builds it in memory in this repo. The human ruled out a drift check in `tools/build-copilot.mjs`.

`templates/workflow.json` is still a hand transcription of the `ai-dlc` skill + orchestrator (lifecycles, gates, clarify matrix, the agent-artifact lifecycles `AAWH` / `AAWP`, which replaced `AAW` on 2026-10-24, WF-1). Nothing checks it against the prose.

**Why:** consumer repos validate offline, so the roster comes from the installed plugin, not the script.
**How to apply:** when a lifecycle, gate, stage skill or clarify row changes in `skills/ai-dlc/SKILL.md` (or an agent is renamed / deprecated), update `templates/workflow.json` in the same change and run `node plugins/claude/ai-dlc/skills/workflow/templates/workflow.mjs validate --file plugins/claude/ai-dlc/skills/workflow/templates/workflow.json --plugin plugins/claude/ai-dlc` (exit 0).

The template formatter is `format()` in `workflow.mjs`; a copy of it reproduces the template byte-for-byte, so regenerate the template through it after a JSON edit rather than by hand.
