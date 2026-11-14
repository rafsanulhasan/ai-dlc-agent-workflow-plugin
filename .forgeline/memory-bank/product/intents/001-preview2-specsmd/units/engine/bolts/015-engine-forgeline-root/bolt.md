---
id: 015-engine-forgeline-root
unit: engine
intent: 001-preview2-specsmd
type: construction-bolt
status: ready
stories: [026-forgeline-root-design, 027-config-path-sweep, 028-config-paths-map, 029-config-readers-fallback, 030-init-and-tests, lens/007-lens-config-reader]
requires_bolts: [002-engine-contract-tooling, 004-engine-events, 005-engine-planning-stages]
enables_bolts: [009-engine-rename, 010-lens-rename, 011-engine-path-sweep, 014-engine-migrate-settings]
created: 2026-11-14
---

# Bolt 015-engine-forgeline-root

**Planned:** nothing here is built yet. The bolt is `ready` (G3 approved, 2026-11-14, D79); the step codes are assigned when the bolt runs, so they read "—" for now.

## Objective

Move the plugin's default layout under one visible root, `.forgeline/` (D53, D66): the memory bank to `.forgeline/memory-bank/`, runs to `.forgeline/execution-plans/`, and the `.ai-dlc/` tooling-config folder to the sub-layout the human decided (D70): `.forgeline/ai-dlc/` (the workflow files, the catalog and `lens.json`), `.forgeline/cost-saving/` (the cache-keepalive and auto-handoff settings and their schemas) and `.forgeline/models/claude/` (the model metadata and its schema). Every reader keeps a one-release read fallback to the old paths. This reverses D16 for the `.ai-dlc/` folder only. `AI_DLC_*` variables, the `<!-- ai-dlc:… -->` managed-block markers, the `[ai-dlc:auto-handoff]` tag, and agent memory paths (D49) do not change; `.handoff/config.md` is not moved, because bolt 004 deletes the stale file (C-14, D73). A preview1 repository then reaches the preview2 layout in one hop. The bolt also refreshes and moves this repository's own installed hook and metadata copies (D71). The `/engine:migrate` move of `.ai-dlc/*` is story engine/031 of bolt 014 (D72), not this bolt.

The `.forgeline/` root is a G1 amendment (D69, approved at G3, 2026-11-14 (D80)): FR-18 with AC-18.1 to AC-18.12, and a reworded AC-16.4. The spec change that implements it is delta r3, written in story engine/026.

## Stories

- [engine/026 forgeline-root-design](../../stories/026-forgeline-root-design.md): ADR-0018 and spec delta r3, the G2 amendment, before any code.
- [engine/027 config-path-sweep](../../stories/027-config-path-sweep.md): the four-pass literal sweep.
- [engine/028 config-paths-map](../../stories/028-config-paths-map.md): `CONFIG_PATHS`, the new `ARTIFACT_TYPES` bank defaults, the area rule.
- [engine/029 config-readers-fallback](../../stories/029-config-readers-fallback.md): readers read the new path first, with a marked fallback; the workflow gate blocks only with an installed layout (D74).
- [engine/030 init-and-tests](../../stories/030-init-and-tests.md): `init` writes the new layout; exact-string tests; fallback vectors; this repository's installed copies (D71).
- [lens/007 lens-config-reader](../../../lens/stories/007-lens-config-reader.md): the lens reads its config files from their `CONFIG_PATHS` places. The one lens story in this bolt: the lens unit owns AC-18.4[lens], and the story is built here because 010 requires 015 (the one cross-unit exception).

Wave: W3 (priority first; starts when 002, 004 and 005 are merged; merges last of the W3 bolts, after 006, 007 and 008, D68; 012 rebases onto it).

## Stages

AAWP construction-bolt: design → lld → change → test → code-review; `docs` and `critique` run after `change`, in parallel with `test`. The orchestrator spawns `research-assistant` for the sweep (story 027) before `design`; it is not a bolt stage.

| Stage | Owner | Artifact | Step code |
|---|---|---|---|
| (pre-step) sweep | research-assistant | sweep result: hits per pass, allowlist, file list | — |
| design | software-architect | ADR-0018 (records the D70 sub-layout and the D16 reversal), spec delta r3 (§2.1, §2.2, §2.3, §3, §10, §11, §16 and §16.1), the `CONFIG_PATHS` table; **human approves delta r3 (G2 amendment) before `lld` starts** | — |
| lld | system-engineer | low-level design (lists this repository's installed copies to refresh and move, D71) | — |
| change | agent-manager | change set | — |
| test | sqa-engineer | `node --test "tests/**/*.test.mjs"` and `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` quoted | — |
| code-review | code-reviewer (standards, spec) | review hand-backs | — |
| docs | documentation-writer | this `bolt.md`, its stories, reader docs per *Docs update* | — |
| critique | brutal-critique | PASS / REVISE | — |

## Success criteria

The ITEM-127 ACs (AC-1 to AC-8 and AC-10 to AC-12; AC-9 is bolt 014's), the delta r3 ACs once approved, and these parts of FR-18 (G1 amendment D69, approved at G3, 2026-11-14 (D80)): AC-18.1 to AC-18.3, AC-18.4[engine], AC-18.4[lens], AC-18.5, AC-18.6, AC-18.7[layout], AC-18.10[hook and metadata copies], AC-18.11 and AC-18.12, with AC-15.8[forgeline-root], AC-15.8[forgeline-root-lens] and AC-16.4[015]. AC-18.8 is delivered by bolt 011 (this bolt's sweep supplies its allowlist), AC-18.9 by bolt 014 and AC-18.7[name] by bolt 009; plus the Definition of Done.

The Definition of Done that holds for every bolt is in [the task plan](../../../../../../../project/plans/001-preview2-specsmd.tasks.md).

## Notes

- **Order inside W3.** It builds beside 008, 007 and 006 and rebases onto them; it merges after the three (D68), then 012 rebases onto it. It is the only W3 bolt besides 012 that edits `workflow.mjs`. 007 and 008 keep to their own `runs-root` and `record` files; the lens readers 015 changes are the four lens files `settings.ts`, `register.tsx`, `lens.ts` and `anomaly.ts` and their tests (the final list is the output of story 027).
- **`ARTIFACT_TYPES` defaults change.** Bolts 002, 003, 004, 005 and 012 write `memory-bank/` and `execution-plans/` strings. They take them from `ARTIFACT_TYPES` or `tests/helpers/paths.mjs` where they can; 015's sweep changes the rest. The byte copies of the canonical vectors (`tests/fixtures/grammar/runs-root.mjs`) in the hook and the lens are re-copied here, and the drift test (002) guards them.
- **Workflow gate blocks only with an installed layout (D74, D76).** `check-workflow.mjs` exits 0 silently when `.ai-dlc/workflow.json` is missing (8.1.1:16). After this bolt it blocks the Stop (AC-18.6) when a folder `.forgeline/ai-dlc/` or `.ai-dlc/` exists, whatever it holds, but neither `workflow.json` does; a bank folder alone does not trigger it. A missing `workflow.json` blocks every Stop in a git repository, whatever git shows (D76); validating an existing `workflow.json` stays change-gated as today; outside a git repository it stays silent; a missing `workflow.mjs` keeps today's block. `AI_DLC_WORKFLOW_GATE=false` and `stop_hook_active` still stop it; with both workflow files it reads the new one and warns that the old one is ignored. Fixtures: layout present, nothing changed, no `workflow.json` → blocks; a folder with only `lens.json` or `model-metadata.json` → blocks; not a git repository → silent. Behaviour change decided by the human (D74, D76), approved at G3, 2026-11-14 (D80).
- **Decided before the lld (both closed by the human, so ADR-0018 records them and does not decide them):**
  - D70, the sub-layout under `.forgeline/` (ADR-0018 also places the `.ai-dlc/` files D70 does not name, at least `herdr.json`, `lens.schema.json`, `model-costing.json` and `event.schema.json`, in one of the three folders, AC-18.2): `.forgeline/ai-dlc/` (`workflow.json`, `workflow.mjs`, `workflow.schema.json`, `catalog.json`, `lens.json`), `.forgeline/cost-saving/` (`cache-keepalive` and `auto-handoff` with their schemas) and `.forgeline/models/claude/` (the metadata and its schema). It closes O-27.
  - D71, this repository's installed copies (`.claude/hooks/check-workflow.mjs`, `.claude/hooks/update-model-metadata.mjs`, `.ai-dlc/workflow.mjs`, `.ai-dlc/model-metadata*.json`): this bolt refreshes them from the plugin templates and moves them to their `CONFIG_PATHS` homes, so `tests/model-metadata/` stays green. It closes O-26. The lld lists the exact files. In the intermediate state (new `workflow.mjs` and hook, old `workflow.json` until ITEM-121) the gate warns once and does not block (AC-18.6).
- Every legacy read branch carries `fallback: remove in 1.0.0` (AC-15.8); ITEM-125's file list grows by them.
- Shared bank files (unit-brief *Bolts* sections, `units.md`, task-plan status columns, the backlog) change once per wave in the `documentation-writer` stage after the wave's merges (S-8), not in this bolt's run.
- A conflict in a generated path is never resolved by hand: take either side and run `node tools/build-copilot.mjs`. A conflict in a `.claude/agent-memory/**` index file is an append conflict: keep both lines.

### Files this bolt touches

Paths as in bolt 013. The final list is the output of story 027; the known ones are:

- Edits: `E/skills/workflow/templates/{workflow.mjs,workflow.json,workflow.schema.json}` (`CONFIG_PATHS`, `ARTIFACT_TYPES` defaults, area rule, `validate`), `check-workflow.mjs` and its template, `update-model-metadata.mjs` and its template, `E/hooks/auto-handoff/config.ts`, `E/hooks/keepalive/keepalive.ts` (with their tests and `ATTRIBUTION.md` lines), `L/` `settings.ts`, `register.tsx`, `lens.ts` and `anomaly.ts` (and their tests; the final list is the output of story 027), the `init` skill and its `AGENTS.md`, `CLAUDE.md` and `copilot-instructions.md` sources (`tools/templates/*`), `tests/workflow/`, `tests/model-metadata/`, `tests/auto-handoff/`, `tests/helpers/paths.mjs`.
- This repository's own installed copies (D71): `.claude/hooks/check-workflow.mjs`, `.claude/hooks/update-model-metadata.mjs`, `.ai-dlc/workflow.mjs` and `.ai-dlc/model-metadata*.json` (the metadata files move to `.forgeline/models/claude/`). The lld fixes the list.
- Creates: ADR-0018 and spec delta r3 (written by `documentation-writer` from the architect's text), `tests/config-paths.test.mjs`, fallback fixtures.
- Must not touch: the plugin folder names and prefixes (009, 010), `docs/follow-ups.md`, the migrate planners (012, 014).
