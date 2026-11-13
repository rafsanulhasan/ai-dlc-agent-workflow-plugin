# Intent 001 — preview2: specsmd memory bank, units/bolts, execution plans with typed events

Status: planned (G1 pending). Release: 1.0.0-preview2 (breaking; preview1 ships first, D7).
Owner: product-owner. Acceptance criteria: [acceptance-criteria.md](acceptance-criteria.md).
Sources: decisions D1-D12 ([decisions-2026-11-13.md](../../../../execution-plans/AI-DLC-20261113-preview2-specsmd/decisions-2026-11-13.md)),
work breakdown ([1.1.6-work-breakdown.md](../../../../execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.6-work-breakdown.md)),
specsmd (fabriqaai/specs.md, MIT). The 13 units of the breakdown are items ITEM-111 to ITEM-123 (unit N is ITEM-(110+N))
in [the backlog](../../../project/backlog.md).

## Problem
Run mechanics and product knowledge are mixed under `docs/` (specs, stories, ADRs, backlog, handoffs). There is no
first-class vocabulary for intents, units and bolts, and no typed record of the orchestrator's commands, handoffs,
handbacks, verdicts and escalations. Authorship of documents is split between stage agents, so what counts as
"done" for knowledge is unclear.

## Users
- Humans who approve gates G1-G4 and read the product knowledge.
- The AI-DLC agents, which read and write the artifacts.
- Maintainers of target repositories on preview1, who must be able to move.

## Outcomes and success measures
1. A target repository keeps its knowledge in one `memory-bank/` (`product/`, `project/`); each artifact type has one home.
   Measure: layout contract exists; `init` creates it; validate checks it.
2. Work is planned as intents, units and bolts with a fixed vocabulary, ids and status model.
   Measure: unit design and bolt design are lifecycle stages with owners, outputs and critique; feeds G2/G3.
3. Run mechanics live in `execution-plans/` with typed events (command, handoff, handback, verdict, escalation).
   Measure: event schema exists; events are files checked by `workflow.mjs validate`.
4. One authorship rule: stage agents own content; only documentation-writer writes memory-bank files;
   brutal-critique gates. Done = engineering state and knowledge state both complete.
   Measure: `docs-status` rewritten; reviews flag a bank file written by any other agent.
5. Existing repositories can move without losing history.
   Measure: documented, tested migration; one-release read fallback with a warning.

## Functional requirements
FR-1 memory-bank layout (product/, project/ incl. backlog); one home per artifact type; old-to-new path map.
FR-2 intent, unit, bolt as first-class constructs: vocabulary, ids, frontmatter, status model (specsmd inconsistencies fixed).
FR-3 unit-design and bolt-design stages in the lifecycles (owners, outputs, gates, critique); feed G2/G3; no new gates.
FR-4 bolt types defined; their relation to lifecycles and agents (including the product-owner preference in Open questions) decided at G2.
FR-5 execution-plans/: one folder per run (not per bolt): the execution plan, handoffs, handbacks, run state and session handoffs. The execution plan and the run state record the intent, unit and bolt ids the run works on; bolt ids are entries, not folders.
FR-6 typed events (command, handoff, handback, verdict, escalation): schema + files, checked by validate; no runtime.
FR-7 authorship rule; a memory-bank tree is documentation; docs-status rewritten; done = engineering + knowledge.
FR-8 workflow.json `artifacts`, schema, validator, template and `init` express the new paths.
FR-9 auto-handoff hook and ai-dlc-lens read the new paths and file names; anomaly.ts run.md-only drift fixed.
FR-10 agent, skill, rule, template and generated prose cite the new paths; no stale `docs/...` references.
FR-11 migration of existing repositories (docs/ to memory-bank/, docs/handoffs/ to execution-plans/), documented and tested.
FR-12 attribution for adapted specsmd material (NOTICE, THIRD_PARTY_NOTICES, ATTRIBUTION; MIT, Copyright 2025 Fabriqa AI).
FR-13 brand-name clash check as research only; no rename.
FR-14 release 1.0.0-preview2: tests, build --check, validate, plugin tests pass; docs and backlog updated; release gate.
FR-15 fallback: preview2 reads old docs/ paths with a warning; dropped in 1.0.0.
FR-16 Copilot parity: changes projected by the build and `--check` passes; Claude-only items stay listed as such;
      agents and generic skills stay language-agnostic; plugin id, `ai-dlc:` prefixes, `.ai-dlc/`, `AI_DLC_*` unchanged.

## Scope
In: everything above. Dogfood: this repo's preview2 planning artifacts live in memory-bank/ and execution-plans/ now (D8).
Out: deterministic runtime/scheduler; plugin rename; specsmd runtime scripts as dependencies; specsmd ideation/FIRE/simple
flows and its operations flow beyond mapping to our release/DevOps stages; changes to preview1.

## Decisions
- 2026-11-13 (D11): reader-facing documents (README.md files, `docs/plugins.md`, user guides, release notes) stay in
  `docs/`; lifecycle knowledge moves to `memory-bank/`. documentation-writer authors both.
- 2026-11-13 (D12): unit 11 (migrate this repo's legacy `docs/` history) must ship in preview2, priority P1.

## Findings
- `.handoff/config.md` is a stale leftover of the third-party `agent-handoff` plugin; no ai-dlc source under `plugins/` or
  `tools/` reads it (source: `execution-plans/AI-DLC-20261113-preview2-specsmd/1.1.8-research-assistant-to-orchestrator.handback.md`, part B).

## Priorities
P0 unit 1 (contracts and ADRs). P1 units 2-9, 11, 12, 13 (unit 11 must ship in preview2). P3 unit 10 (brand research).

## Definition of done (preview2)
- Every FR has numbered, testable ACs accepted at G1; the frozen spec passes G2; the task plan passes G3.
- Per unit: engineering complete (build, tests, reviews) and knowledge complete (bank content current, written by
  documentation-writer, critiqued by brutal-critique, statuses match run state).
- Repository checks pass, quoted by the owning agents: `node --test "tests/**/*.test.mjs"`,
  `node tools/build-copilot.mjs --check`, `node tools/validate.mjs`, `plugin test` for ai-dlc and ai-dlc-lens.
- A fresh `init` and a migrated preview1 repository both work end to end; fallback warns once per invocation (AC-15.2).
- Unit 11: this repository's legacy `docs/` history migrated (AC-11.10, D12).
- Attribution files updated; release notes written; no open P0; G4 approved; release go/no-go by product-owner.

## Open questions
- Bolt-type mapping details: decided at G2 (PO preference: do not map bolt types one-to-one to lifecycles; a bolt's type
  picks the stage template inside a lifecycle; the architect verifies the specsmd bolt type list).
