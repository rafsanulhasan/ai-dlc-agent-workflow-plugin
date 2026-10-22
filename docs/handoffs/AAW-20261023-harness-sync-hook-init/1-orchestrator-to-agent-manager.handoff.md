---
from: orchestrator
to: agent-manager (fresh)
step: 1
run: AAW-20261023-harness-sync-hook-init
---
# Handoff: init installs an automatic harness-sync hook; plugin-management documents the new setup
You own harness-sync and plugin-management; this brief is exactly this change.
1. **harness-sync skill** (`plugins/claude/ai-dlc/skills/harness-sync/`): add what is needed to install a hook in a consumer repository that runs `node .claude/scripts/sync-harness.mjs` automatically: a Claude Code `Stop` hook in `.claude/settings.json` (merged, never replacing existing entries; JSONC-safe in-place edit, as init's other hooks do) and its GitHub Copilot equivalent where Copilot has a matching event (`.github/hooks/…json`; skip with a note where it has none). Behaviour: sync, then carry on; never loop, never block when nothing is pending. Follow hook-management's conventions.
2. **init** (`plugins/claude/ai-dlc/skills/init/SKILL.md`): in Phase 2 "Harness sync script", after copying the script, install that hook (skip if already installed and identical; diff then consent for an existing different one); mention it in Phase 1 and Phase 3.
3. **plugin-management/SKILL.md**: document this repository's new setup, made in run AAW-20261023-keepalive-cleanup-sync: the sync Stop hook in `.claude/settings.json`, the `sync-harness --check` CI step before `plugin validate` in validate.yml, and the local validate script (read that run's hand-back for the exact names once it lands; if it has not landed, describe it from its handoff record's amendment and mark the names to confirm).
Another agent-manager is editing keep-alive, `.claude/settings.json`, validate.yml, CLAUDE.md and tools/ in parallel: do not touch those files. Rebuild and --check; run the repository tests and both plugin validate. Don't commit.
Return: line 1 `handoff <this file>: passed|failed — <why>`, the changed paths marked code/docs, the checks.
