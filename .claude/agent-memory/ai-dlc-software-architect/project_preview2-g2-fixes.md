---
name: preview2-g2-fixes
description: Architect content decisions for the preview2 G2 critique (step 1.1.22) - shared registration files, settings rewrite scope, pane ids lens-*, plan as schedule of record
metadata:
  type: project
---

Step 1.1.22 (2026-11-14) decided the G2 critique fixes for intent 001 (preview2, branch plan/preview2, worktree .worktrees/preview2-planning).

- **Shared registration files**: engine owns `.claude-plugin/marketplace.json`, `tools/claude-only-plugins.json`, `tools/claude-only-skills.json`, `.github/workflows/validate.yml`, `tests/helpers/paths.mjs`; lens owns only its own entries there (bolt 010 edits them). `tools/validate.mjs` reads claude-only-plugins.json, so it has no lens path. Lens also owns `tests/lens-renderer/` and `tests/cache-reader/`.
- **Settings rewrite** (`migrate`): only keys of marketplace `ai-dlc-agent-workflow`; `ai-dlc@<other>` gets `advice:`, and while present the `ai-dlc:` prefix rules are advice-only in that file (TheBushidoCollective's `ai-dlc`).
- **Pane ids (D33)**: `PaneOpenArgs.id` allows only letters, digits, `_`, `-` (1-64), so `lens:*` becomes `lens-*`; legacy ids closed at load (extends `closeOldCard`). Lens's own state atoms `{plugin:'ai-dlc-lens'}` (~40) rename to `lens` via one constant.
- Task plan = schedule of record; spec §16 governs bolt scope; backlog wave table superseded; old "unit N" = "work item N".
- 1.1.20 review ids written `SA-R1`, `SA-C1`, `SA-K4` to avoid colliding with the AC file's R1-R10 / C-n.

**Why:** brutal-critique 1.5.l3.5 REVISE; human D33-D35.
**How to apply:** reuse these rules when reviewing bolts 009-012; check bolts never edit the other unit's registration entries.
