---
id: 008-lens-new-paths
unit: lens
intent: 001-preview2-specsmd
type: simple-bolt
status: ready
stories: [001-lens-reads-execution-plans, 002-run-state-file-names, 003-lens-fallback-notice]
requires_bolts: [002-engine-contract-tooling, 004-engine-events]
enables_bolts: [009-engine-rename]
created: 2026-11-14
---

# Bolt 008-lens-new-paths

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

The lens reads `execution-plans/`, the record grammar, verdicts and escalations; names the real run-state file; and falls back to `docs/handoffs/` with one notice per scan (ITEM-116 part b; the lens part of ITEM-117).

## Stories

- [lens/001 lens-reads-execution-plans](../../stories/001-lens-reads-execution-plans.md)
- [lens/002 run-state-file-names](../../stories/002-run-state-file-names.md)
- [lens/003 lens-fallback-notice](../../stories/003-lens-fallback-notice.md)

Wave: W3 (early start once 004 is merged; priority after 015).

## Stages

AAWP simple-bolt: change → test → code-review; `docs` and `critique` run after `change`. `intent`, `design` and `lld` are skipped.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| change | agent-manager | change set | — |
| test | sqa-engineer | the test stage quotes `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens` | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

AC-1.6[lens], AC-6.5[lens], AC-9.2, AC-9.3, AC-9.4[lens], AC-9.5[lens], AC-15.1 to AC-15.8[lens]; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- O-4 is decided (product-owner, D43), so this bolt can start: the toast is deduplicated by text per session, and each scan writes one log entry and one `/lens:gate` `skipped` entry. The AC-15.7 test asserts it.
- It edits only lens-owned files (Component boundaries) and implements no G-FM (C-3): the lens keeps its `frontMatter` reader.
- It may start once bolt 004 is merged; the wave label stays W3. Testable live on this repository (D42).
- Shared bank files (the unit-brief *Bolts* sections, `units.md`, the task-plan status columns and `memory-bank/project/backlog.md`) change once per wave, in one `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run. This bolt's own `bolt.md` and stories stay inside its run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths: `E/` is the engine plugin folder (`plugins/claude/ai-dlc/` until bolt 009, `plugins/claude/engine/` after), `L/` the lens plugin folder (`plugins/claude/ai-dlc-lens/` until bolt 010, `plugins/claude/lens/` after), `WF/` is `E/skills/workflow/templates/`. Generated outputs (`plugins/copilot/**`, the `init` templates `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md`, `skills/plugin-management/templates/build-copilot.mjs`, the `.claude/skills/` mirrors) are never edited by hand: rebuild with `node tools/build-copilot.mjs`.

- Edits: `L/hooks/anomaly.ts` (`handoffsRoot` out, `detectRun(dir, run, files, now)`, two text sites), `L/hooks/lens.ts` (`RECORD_NAME` and `parseRecord` to `record.ts`), `L/hooks/register.tsx` (`scanRuns` notes, `readRunState` returns `{file, text}`, `want`, `gateWaiting` and `gateRejected`), `L/hooks/settings.ts` (three text sites), `L/hooks/ATTRIBUTION.md`, `L/tests/lens.test.tsx` (6,695 lines (from 1.1.24; recheck at bolt start); the `detectRun` call sites), and `E/skills/lens-gate/SKILL.md` (the one engine-folder file this bolt edits, F-6; see *Must not touch*).
- Creates: `L/hooks/record.ts`, `L/hooks/runs-root.ts`, `L/tests/{record,runs-root}.test.ts`, `L/tests/fixtures/grammar/{record-names,runs-root,fallback-warning}.mjs` (byte copies).
- Must not touch: `E/**` except the text of the lens-gate skill, `E/skills/lens-gate/SKILL.md`, which sits under the engine folder until bolt 010 and is the only one of the five lens skills this bolt edits (F-6, accepted in step 1.1.28); `tests/helpers/paths.mjs`; any shared registration file.
