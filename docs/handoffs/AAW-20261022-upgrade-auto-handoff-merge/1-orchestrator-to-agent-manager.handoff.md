---
run: AAW-20261022-upgrade-auto-handoff-merge
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager (freshly spawned; this brief is exactly this change)
mode: subagent
loop: none
---

# Brief: `/ai-dlc:workflow upgrade` also merges `.ai-dlc/auto-handoff.json`

Human decision (2026-10-22, flagged P2): `upgrade` keeps every `.ai-dlc` file current after a plugin update. Today `/ai-dlc:init` (re-run) and `/ai-dlc:configure-auto-handoff` run the add/remove merge (CLI `merge` in plugins/claude/ai-dlc/skills/configure-auto-handoff/templates/auto-handoff.mjs: adds new keys as null, removes deleted ones, keeps set values); `/ai-dlc:workflow upgrade` does not.

Change the workflow skill (plugins/claude/ai-dlc/skills/workflow/, SKILL.md *upgrade* mode and any reference) so `upgrade` also runs that merge when `.ai-dlc/auto-handoff.json` exists (and installs/refreshes the CLI and schema the same way configure-auto-handoff does, by following that skill's SKILL.md per the plugin rule that skills read sibling SKILL.md via `${CLAUDE_SKILL_DIR}/../<skill>/SKILL.md`). Claude-only behaviour: on Copilot say it does not apply (the auto-handoff module is Claude-only). When the file doesn't exist, upgrade doesn't create it (say so, point to configure-auto-handoff). If workflow.mjs needs a change, add tests under tests/workflow/. Update README/docs that describe upgrade if any.

Checks: `node tools/build-copilot.mjs` then `--check`, `node --test "tests/**/*.test.mjs"`, `node .ai-dlc/workflow.mjs validate`, both `plugin validate --strict`. If .ai-dlc/catalog.json must change, regenerate it and say so. Don't commit. Another agent-manager edits the auto-handoff module, handoff SKILL.md and README in parallel — avoid those files unless essential (then say so).

Hand-back: first line `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`; changed paths marked code/docs/generated; intent; real check output.
