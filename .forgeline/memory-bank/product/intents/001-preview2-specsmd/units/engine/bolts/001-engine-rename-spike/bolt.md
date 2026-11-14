---
id: 001-engine-rename-spike
unit: engine
intent: 001-preview2-specsmd
type: spike-bolt
status: ready
stories: [001-rename-platform-facts]
requires_bolts: []
enables_bolts: [009-engine-rename, 010-lens-rename, 014-engine-migrate-settings]
created: 2026-11-14
time_box: 2d
---

# Bolt 001-engine-rename-spike

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

Observe, live in Claude Code, the platform behaviour the rename depends on (spec §16, items (a) to (i)), before any rename code is written.

## Stories

- [engine/001 rename-platform-facts](../../stories/001-rename-platform-facts.md)

Wave: W1 (in parallel with 002 and 003).

## Stages

This is the one-off ASDLC override of D40: research → probe → architecture. `probe` and `boltTypes` do not exist until bolt 005.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| research | research-assistant | documented platform behaviour for (a) to (i), cited | — |
| probe | software-engineer | commands, real output and the Claude Code version; writes only under `.scratch/` | — |
| architecture | software-architect (after research and probe) | findings against the spec; any `spec-driven-development` revision list | — |

- Skipped: `low-level-design`, `spec` and `narrative`. G2 is not held for this bolt (O-6, D40).
- The human accepts the hand-back, recorded as `{code}-human-to-orchestrator.verdict.md` in the exact §8.3 shape. It is not validated, because the run does not opt in to events, and preview1 readers ignore it. Bolt 004 copies this file into its `events` tests as one valid vector (R-11).
- `documentation-writer` writes the research note `memory-bank/project/research/001-engine-rename-spike.md`.

## Success criteria

AC-17.14, and the human accepts the hand-back.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- Findings (c), (e), (h) and (i) are consumed by lens bolt 010 (R-3). The spike hand-back and the research note label them as lens-consumed, and bolt 010's success criteria and notes cite them. If finding (c) fails, it goes to the human as a new decision.
- Finding (a) can change the memory-folder pattern in AC-17.6, AC-17.9, AC-17.10 and AC-17.12 through `spec-driven-development` before bolt 009.
- "The migration bolt" of AC-17.14 is bolt 014 (C1): bolt 012 does not wait for this hand-back, bolt 014 does.
- Findings (c), (h) and (i) need an interactive session (`/reload-plugins`, a new session, panes): plan for steps the human runs. The probe writes each check as a numbered script, so the human only runs it and pastes the output.
- **Confirmed by the human (D82):** a 2 to 4 hour session on days 1 and 2 of W1 (30 to 60 minutes per check, plus 0.5 to 1 hour to read the hand-back and accept it), so that a failed (c) or a changed (a) is known while 002 still runs. If the human is unavailable, bolt 009 slips, and the intent end date moves with it.
- `time_box` is a convention, a string `<n>d`; `validate` does not check it (C2).
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Tracked changes: none. The probe writes only under `.scratch/`; a tracked file in its change set is a Blocker.
- Docs stage (`documentation-writer`): `memory-bank/project/research/001-engine-rename-spike.md`, this `bolt.md`, `engine/001`.
