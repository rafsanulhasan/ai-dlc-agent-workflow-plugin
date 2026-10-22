---
name: harness-sync-command
description: Consumer repos get no sync hook; /ai-dlc:harness-sync is a user-only command running sync-harness.mjs; agents run the script directly
metadata:
  type: project
---

Human decision 2026-10-23 (run AAW-20261023-harness-sync-hook-init): consumer repositories get **no** harness-sync hook. `/ai-dlc:harness-sync [args]` is a plugin command (`disable-model-invocation: true`) that runs `node .claude/scripts/sync-harness.mjs [args]` and shows the output; init only copies the script. Only the plugin repo syncs automatically (its repo-local `.claude/hooks/sync-harness-on-stop.mjs` chained in `stop-sync-then-check.mjs`, CI `--check`, `tools/validate.mjs`).

**Why:** the human wants the developer to run the two-way sync by hand, not a Stop hook.

**How to apply:** agents never call `Skill("ai-dlc:harness-sync")` (it is user-only); they follow its *For agents* section and run the script directly. `agents/agent-manager.md` and the management skills still held `Skill("ai-dlc:harness-sync", ...)` calls when this was written — a follow-up fresh agent-manager change. Coverage of both directions per kind: `tests/sync-harness.test.mjs`.
