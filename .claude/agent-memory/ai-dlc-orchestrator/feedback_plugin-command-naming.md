---
name: plugin-command-naming
description: ai-dlc plugin commands are /ai-dlc:<feature>[-<action>]; plugin settings never go in /config rows (userConfig)
metadata:
  type: feedback
---

Every ai-dlc command carries the `ai-dlc:` prefix plus the feature name: `/ai-dlc:cache-keepalive`, `/ai-dlc:cache-keepalive-config`. Plugin settings are never exposed as `/config` rows (manifest `userConfig`). They live in `AI_DLC_*` env variables and in the `.ai-dlc/<feature>.json` files, changed through the feature's own command. `/ai-dlc:configure-auto-handoff` keeps its name (human decision, 2026-10-23).

**Why:** the human wants one consistent, discoverable command namespace, and settings managed by ai-dlc's own commands rather than Claude Code's `/config` (decided in run AAW-20261022-cache-keepalive-init).

**How to apply:** route any new plugin command or setting with this shape. Flag a userConfig row or an unprefixed command in a brief or review. Don't add migration fallbacks or notes for unreleased-preview changes unless asked.

Related: [[auto-handoff-decisions]], [[review-budget]]
