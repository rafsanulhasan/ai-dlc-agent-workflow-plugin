---
name: claude-only-plugins
description: Since 2026-10-23 plugins/claude/ holds a second plugin, ai-dlc-lens (Claude-only, listed in tools/claude-only-plugins.json); how the build, validate.mjs and CI treat it
metadata:
  type: project
---

Since 2026-10-23 (run AAW-20261023-lens-plugin-from-spike) `plugins/claude/` holds two plugins: `ai-dlc` and `ai-dlc-lens` (spike 027 moved there, still behind run FEAT-20261020-ai-dlc-lens's gates G1-G3). `tools/claude-only-plugins.json` lists the lens: `build-copilot.mjs` ignores listed folders when picking the plugin (else two folders would need `--plugin`), refuses them as `--plugin`, and fails on a `plugins/copilot/<name>/` folder for one. `tools/validate.mjs` adds a `validate --strict` step per listed plugin; CI has explicit validate + test steps for the lens.

**Why:** the human chose "new plugin, gates still apply"; stories US-4 require the Copilot build to skip the lens and only the Claude marketplace to list it.

**How to apply:** any new Claude-only plugin goes in that list. Tests that list `plugins/claude/` must not assume readdir order (ext4 in CI is not alphabetical). Spike 029 (avatar images) was merged into the lens on 2026-10-23 (robot avatars, `hooks/avatar.ts`) and removed. Spike 028 moved in on 2026-10-23 (step 1.3): ai-dlc keep-alive publishes `$.state` `{ plugin: 'ai-dlc', key: 'keepalive' }` (contract `plugins/claude/ai-dlc/types/index.d.ts`, manifest `types`), the lens reads it read-only with no `dependencies`; `spikes/` is gone and the marketplace lists only ai-dlc and ai-dlc-lens. Related: [[hooks-module-typecheck]], [[plugin-test-harness-quirks]]. Step 1.4 (2026-10-24): the lens commands are six Claude-only ai-dlc skills (`lens`, `lens-init`, `lens-configure`, `lens-kit`, `lens-keepalive`, `lens-gate`) answered by the lens's `command.run` hooks; the mod registers none; panes are `ai-dlc-lens-*`.
