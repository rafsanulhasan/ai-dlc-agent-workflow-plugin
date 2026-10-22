---
name: harness-sync-decisions
description: 2026-10-23 human decisions on harness sync — consumer repos get a user-only command, never a hook; only the plugin repo syncs automatically; agents ask on conflicts
metadata:
  type: project
---

- **Consumer repositories:** no sync hook. They sync with `/ai-dlc:harness-sync [args]`, a **plugin slash command** (user-invoked only, `disable-model-invocation: true`) that runs `node .claude/scripts/sync-harness.mjs` — two-way for agents, skills, commands↔prompts, rules↔instructions, hooks; `--check` reports only. The human first said "skill", then corrected it to "command".
- **Plugin repository only:** automatic sync — one Stop command (`stop-sync-then-check.mjs`: the sync, then check-copilot-stale, because Claude Code runs the hooks of one event in parallel), CI `sync-harness --check` before `plugin validate`, `node tools/validate.mjs`.
- **Agents:** never call `Skill("ai-dlc:harness-sync")`; follow its *For agents* section. When one item's twins were both edited: `--check` first, ask the human which side wins, sync with `--prefer`; never let `newer` decide.
- **Plugin icon:** `plugin validate --strict` warns there is no icon; the human chose to leave it for now.

**Why:** the human wants syncing in target repos to be explicit and human-driven, and automation only where the plugin itself is developed.

**How to apply:** don't propose installing hooks into consumer repositories for syncing; route sync questions to the command; keep hooks that depend on each other in one command.

Related: [[plugin-command-naming]], [[review-budget]]
