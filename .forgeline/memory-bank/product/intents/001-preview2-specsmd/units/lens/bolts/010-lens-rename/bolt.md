---
id: 010-lens-rename
unit: lens
intent: 001-preview2-specsmd
type: simple-bolt
status: draft
stories: [004-lens-plugin-identity, 005-lens-commands-and-panes, 006-dual-engine-prefix]
requires_bolts: [001-engine-rename-spike, 009-engine-rename]
enables_bolts: [011-engine-path-sweep, 014-engine-migrate-settings]
created: 2026-11-14
---

# Bolt 010-lens-rename

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The lens side of §11 and §12: the `lens` plugin, the `/lens:*` commands, the `lens-*` panes and the dual prefix (ITEM-126, lens).

## Stories

- [lens/004 lens-plugin-identity](../../stories/004-lens-plugin-identity.md)
- [lens/005 lens-commands-and-panes](../../stories/005-lens-commands-and-panes.md)
- [lens/006 dual-engine-prefix](../../stories/006-dual-engine-prefix.md)

Wave: W4 (serialised directly after 009).

## Stages

AAWP simple-bolt: change → test → code-review; `docs` and `critique` run after `change`. `intent`, `design` and `lld` are skipped.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| change | agent-manager | change set | — |
| test | sqa-engineer | the test stage quotes `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/lens`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/lens`, `node --test "tests/**/*.test.mjs"` (the bolt edits `tests/helpers/paths.mjs`, `tests/lens-renderer/*`, `tests/cache-reader/*` and the lens half of `tests/state-namespace.test.mjs`) and the check that `plugins/claude/ai-dlc-lens` no longer exists (AC-17.2[lens]) | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-15.8[lens-rename], AC-16.2[010], AC-16.4[010], AC-17.1[lens], AC-17.2[lens], AC-17.5[lens], AC-17.11, AC-17.13[lens]; plus the Definition of Done. It cites spike findings (c), (e), (h) and (i).

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It uses spike findings (c), (e), (h) and (i), and AC-17.14 is owned by engine (R-3). It does not start before the human accepts the spike hand-back (D40). A failed (c) goes to the human as a new decision.
- Its docs stage updates the lens README and `MANUAL-CHECKS.md` (R-9).
- A sweep hit in a lens-owned path (bolt 011) comes back as a fix round of this bolt.
- 146 `ai-dlc:` fixtures (from 1.1.24; recheck at bolt start) stay valid under the dual-prefix window.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Moves: `git mv plugins/claude/ai-dlc-lens plugins/claude/lens` (51 files (from 1.1.24; recheck at bolt start)); the five skills from `E/skills/{lens,lens-configure,lens-init,lens-kit,lens-gate}` to `L/skills/{show,configure,init,kit,gate}`.
- Edits: `L/hooks/register.tsx` (`CMD`, the `CHART` pane id, `KEEPALIVE_COMMAND`, about 45 atoms to `LENS_STATE_NS`), `L/hooks/lens.ts` (`typeOfWorker`, `roleOf`), `L/hooks/avatar.ts`, `L/hooks/settings.ts` (`rosterPath` and its fallback), `L/tests/**`, the literals in the lens-owned existing tests (`tests/lens-renderer/*` and `tests/cache-reader/*`), the lens marketplace entry, `tools/claude-only-plugins.json`, `tools/claude-only-skills.json` (five lines out), the two lens CI steps, `tests/helpers/paths.mjs` (the `LENS_*` values), and the lens lines of the agent artifacts bolt 009 changed, if any (R-14).
- Creates: `L/hooks/identity.ts` (`LENS_STATE_NS` and the pane ids `lens-*`; introduced with today's values first and flipped second), `L/hooks/engine-names.ts` (the dual-prefix window and `LEGACY_PANE_IDS`), `L/tests/{engine-names,commands}.test.ts`, the lens half of `tests/state-namespace.test.mjs`.
- Spike-sensitive values, one home each: the lens atom namespace (e) in `LENS_STATE_NS` (a grep test: no `plugin: 'ai-dlc-lens'` literal remains in `register.tsx`); the pane ids and legacy ids (h, i) in `identity.ts` and `engine-names.ts` (a grep test: no pane-id literal outside those files); the command prefixes (g) in `CMD`, each equal to its skill folder name; the dual-prefix window in `engine-names.ts`, read by `avatar.ts` and `lens.ts`; the shared keep-alive namespace follows spike (e).
