---
id: 018-engine-plugin-identity
unit: engine
intent: 001-preview2-specsmd
status: draft
priority: must
bolt: 009-engine-rename
created: 2026-11-14
---

# engine/018 — The plugin is `engine`, in the marketplace `forgeline`

**Planned:** nothing here is built yet. The story belongs to [bolt 009-engine-rename](../bolts/009-engine-rename/bolt.md), which has not started (G3 pending).

## Story

As a user installing the team, I want the plugin to be `engine` in the marketplace `forgeline`, so that its names match the product (D30, D32).

## Acceptance criteria

- AC-17.1[engine]
- AC-17.2[engine]
- AC-17.7
- AC-16.4[009]
- AC-16.6 (new in spec r1, [change 3.1](../../../../../specs/001-preview2-specsmd.spec.r1-delta.md); pending human acceptance at G3)

A part (`AC-x[part]`) belongs to this story alone. An AC is met when all its parts are met (spec 001 §16.1, revision r1).

## Technical notes

- Both plugin folders move with `git mv`. Commit the `git mv` separately from the content edits.
- Manifest: the `name` changes, `displayName` is kept, and the keywords are those of D35 and D36.
- Both marketplace files take the name `forgeline` and the `engine` entry. The lens entry stays until bolt 010.
- It brings `MARKER_NS`, the guard `manifest.name === PLUGIN`, and the catalog `plugin.name`.
- `ENGINE_DIR` and the other engine values in `tests/helpers/paths.mjs` take their new values. The literals in the engine-owned existing tests are edited by hand (12 files with static imports, plus the tests that assert names).
- The agent artifacts that name the old folder change through `agent-manager`: the `CLAUDE.md` dev setup, `.claude/rules/plugin-development.md` (twin by the harness sync), the `.claude/settings.json` permission with path `./plugins/claude/ai-dlc`, and `tools/validate.mjs`. `.claude/settings.json` line 3 (`"agent"`) and line 113 (the marketplace key) are left to ITEM-121's `migrate` dogfood (AC-11.10); only if spike finding (f) shows that an `"agent"` naming an unknown plugin agent breaks session start does this bolt change line 3, and ITEM-121's hand-back records it.
- AC-16.6 (proposed here, pending the human at G3): a `windows-latest` job in `.github/workflows/validate.yml` runs `node --test "tests/**/*.test.mjs"`, about 0.25 d. The bolt quotes the job's first run; if tests fail on Windows, the job keeps running `node --test` on the tests present at 009's merge, the bolt's hand-back reports the Windows failures, and `product-owner` decides the follow-up. If the human does not accept the AC, this part is not written.
- The [engine] part of AC-17.2 checks that `plugins/claude/ai-dlc/` and `plugins/copilot/ai-dlc/` are gone.
