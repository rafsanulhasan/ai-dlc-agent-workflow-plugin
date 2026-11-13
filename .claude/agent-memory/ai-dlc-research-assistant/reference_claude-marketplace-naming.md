---
name: claude-marketplace-naming
description: Claude Code / Copilot marketplace naming rules, no documented marketplace rename, and the public `ai-dlc` collision (TheBushidoCollective), checked 2026-11-13
metadata:
  type: reference
---

Checked 2026-11-13 against code.claude.com/docs/en/plugins/marketplace-reference.md, host-marketplace.md, manifest-reference.md, loading.md and docs.github.com Copilot CLI plugin reference.

- Claude marketplace `name`: letters, digits, `.`, `_`, `-`, start alphanumeric, no `..`; reserved list in marketplace-reference "Reserved names". A user cannot register two marketplaces with the same name. No rule bars a marketplace name equal to a plugin name (docs silent).
- Copilot marketplace `name`: kebab-case, max 64; the manifest name is the registration key; CLI has no rename.
- Plugin `renames` map migrates plugin names only inside one marketplace; no documented marketplace rename (inference: remove + add + reinstall).
- Hooks-module `command.run` filter takes the full namespaced string (`<plugin>:<skill>`); `register` refuses a colon. Components are namespaced under the manifest `name`.
- Public collision: github.com/TheBushidoCollective/ai-dlc has marketplace.json name `ai-dlc` listing plugin `ai-dlc` (commands /ai-dlc:setup etc.). npm `ai-dlc` returned 404 on registry.npmjs.org/ai-dlc.
