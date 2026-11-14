---
id: 007-engine-handoff-hook
unit: engine
intent: 001-preview2-specsmd
type: simple-bolt
status: draft
stories: [016-hook-reads-execution-plans, 017-hook-fallback-warning]
requires_bolts: [002-engine-contract-tooling, 004-engine-events]
enables_bolts: [009-engine-rename]
created: 2026-11-14
---

# Bolt 007-engine-handoff-hook

**Planned:** nothing here is built yet. The bolt is a draft until the human approves G3; the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The auto-handoff hook reads `execution-plans/` and the new record grammar, and falls back to `docs/handoffs/` with one notice (ITEM-116 part a).

## Stories

- [engine/016 hook-reads-execution-plans](../../stories/016-hook-reads-execution-plans.md)
- [engine/017 hook-fallback-warning](../../stories/017-hook-fallback-warning.md)

Wave: W3 (second in priority; early start once 004 is merged).

## Stages

AAWP simple-bolt: change → test → code-review; `docs` and `critique` run after `change`. `intent`, `design` and `lld` are skipped.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| change | agent-manager | change set | — |
| test | sqa-engineer | the test stage quotes `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` and the node test run | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-1.6[hook], AC-6.5[hook], AC-9.1, AC-9.4[hook], AC-9.5[hook], AC-15.1 to AC-15.8[hook]; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- It may start once bolt 004 is merged; the wave label stays W3. It implements no G-FM (C-3, C-6).
- The hook's own copies of the resolver, formatter and G-REC are held to the shared vectors by the drift test from bolt 002 and, against the code, by `plugin test`. Its first test confirms that a `.mjs` fixture imports under `plugin test` (precedent: the lens's `tests/fixtures/scrub-cases.mjs`).
- Every change gets an `ATTRIBUTION.md` entry.
- Testable live on this repository (D42): the preview1 hook already takes the runs root from `artifacts.handoffs`, so it finds the runs in `execution-plans/`.
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits (all under `E/hooks/auto-handoff/`): `run.ts` (replace `handoffsRoot` and `CODE`; add `answerOf`; `openInRow` exempts `-to-human.escalation.md`), `register.tsx` (`runLookup`: one note per firing; panel step; toast), `config.ts` (toast), `ATTRIBUTION.md`, and the tests `tests/run.test.ts` (26 legacy-path hits) and `tests/auto-handoff.test.tsx` (43 hits, 3,443 lines).
- Creates: `record.ts` and `runs-root.ts` (same file names and exports as the lens: `parseRecordName`, `RECORD_TYPES`, `resolveRunsRoot`, `formatFallbackWarning`, `MIGRATE_ENTRY`), `tests/record.test.ts`, `tests/runs-root.test.ts`, `tests/fixtures/grammar/{record-names,runs-root,fallback-warning}.mjs` (byte copies of the canonical vectors).
- Must not touch: `E/hooks/keepalive/` (bolt 009's), `workflow.mjs`, the template, `orchestrator.md`.
