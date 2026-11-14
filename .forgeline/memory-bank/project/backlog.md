# Product Backlog — AI-DLC Agent Workflow (memory-bank/project)

Content owned by `product-manager` (`product-planning` skill); written by `documentation-writer`. Priorities: P0 critical blocker · P1 high · P2 medium · P3 low.

This file is the backlog's new home (decision D10, 2026-11-13). Items ITEM-001 to ITEM-110 stay in `docs/backlog/backlog.md` and are moved by ITEM-121 (work item 11). This file holds only the `1.0.0-preview2` milestone and the follow-up item for 1.0.0, numbered from ITEM-111.

<!-- Items use this shape:

### ITEM-001: <Title>
- **Type**: Feature | Bug | Security | TechDebt | Release
- **Priority**: P0 | P1 | P2 | P3
- **Status**: Backlog | In Progress | Review | Done | Cancelled
- **Lifecycle**: AI-DLC | PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC | AAWH | AAWP | release | no lifecycle (<agent chain>, as the item states it)
- **Milestone**: <version or "Unplanned">
- **Added**: YYYY-MM-DD
- **Agent Chain**: <e.g. requirement-analyst → software-architect → software-engineer → sqa-engineer>

**Acceptance Criteria**
- [ ] AC-1 <verifiable condition>
-->

## Milestone 1.0.0-preview2 — intent 001: specsmd memory bank, units and bolts, execution plans with typed events

Source: intent 001 (`memory-bank/product/intents/001-preview2-specsmd/requirements.md`, G1 approved 2026-11-13; FR-17 amendment approved, D26); work breakdown step 1.1.6 and decisions D1–D37 in `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/`. Items ITEM-111 to ITEM-123 are work items 1 to 13 of the 1.1.6 breakdown (work item N = ITEM-(110+N)); in this file "unit" means only `engine` or `lens` (D27, D34). All are Type Feature unless stated, Milestone **1.0.0-preview2**, Added 2026-11-13, Status Backlog. ITEM-124 is the release; ITEM-125 is the follow-up for 1.0.0; ITEM-126 is the rename (FR-17).

**Planning only for now:** intent 001 passed G1 on 2026-11-13 (D13); the FR-17 amendment was approved (D26). Each item's ACs are the intent's FR ACs, traced below as "intent AC-n.m" (the requirement-analyst's list, step 1.1.9, with the product-owner's changes of step 1.1.10; see `memory-bank/product/intents/001-preview2-specsmd/acceptance-criteria.md`). The FR-17 amendment is approved and spec 001 is frozen (G2, D38), so the FR and AC numbers change only through a spec revision delta (r1); update this file when one is approved.

**Priorities (product-owner, updated by the human):** P0 work item 1 (the contract, delivered as spec 001 at G2). P1 work items 2-9, 11 (D12: must ship in preview2), 12, 13. Release and 1.0.0 follow-up (P1): product-manager's proposal (1.1.11), for the product-owner to confirm. P3 work item 10 (research only, not release-gating).

**Schedule:** the bolt waves of the [task plan](plans/001-preview2-specsmd.tasks.md) are the schedule of record (G2; reshaped at G3 planning, 2026-11-14). The work-item waves of step 1.1.11 are superseded; any "Depends on" or "Wave" clause in an item below that conflicts with the task plan is history and schedules nothing.

14 bolts: 001 to 014 (012 was split into 012 and 014 by the product-owner, step 1.1.29, where the halves were called 012a and 012b; the ids were settled in step 1.1.30.2).

| Item | Delivered by (task plan) |
|---|---|
| ITEM-111 | spec 001 and ADR-0011 to ADR-0016 (G2); no bolt |
| ITEM-112 | bolt 002 (W1) |
| ITEM-113 | bolt 003 (W1) |
| ITEM-114 | bolts 005 (W2) and 006 (W3) |
| ITEM-115 | bolt 004 (W2) |
| ITEM-116 | bolts 007 and 008 (W3; each may start once 004 is merged) |
| ITEM-117 | bolt 011 (W6, after ITEM-121, R-1); the lens's legacy strings are in bolt 008 (W3) |
| ITEM-118 | bolt 012 (W3, non-blocking; fallback W5 before 014) and bolt 014 (W5) |
| ITEM-119 | bolt 013 (W2) |
| ITEM-120 | not scheduled (P3, non-gating) |
| ITEM-121, ITEM-122, ITEM-123, ITEM-124 | W6, intent-level, in that order (the sweep, bolt 011, runs between ITEM-121 and ITEM-122) |
| ITEM-125 | after preview2 (1.0.0) |
| ITEM-126 | bolts 001 (W1), 009 and 010 (W4), 011 (W6) and 014 (W5) |

Not an ITEM: feature 6 of this run (step 6, an AAWH change), D42: this repository's `artifacts.handoffs` now points at `execution-plans/`. Done 2026-11-14 (D42); it lands before bolt 007 is merged into any checkout the team runs on. It has no ITEM id and is recorded here as a note.

Critical path (task plan): 002 → 004 → 008 → 009 → 010 → 014 → ITEM-121 → 011 → ITEM-122 → ITEM-123 → ITEM-124. The W3 path is 004 → 008 (the longest W3 bolt), not 005 → 006; 005 → 006 only has to finish before 009 starts. Bolt 001's hand-back is accepted by the human before 009 starts (D40). Bolt 012 is off the critical path (it needs only 002) and never delays 009. No item is a security fix, so nothing is `route-immediately`.

**Release precondition (D7, intent AC-14.1; decision C-12):** no preview2 change is merged into the preview1 release line before `1.0.0-preview1` is tagged. The version-bump merge is the last of these merges.

**Decisions recorded at G3 planning** (2026-11-14; sources: steps 1.1.25, 1.1.25.1, 1.1.27, 1.1.28, 1.1.29, 1.1.30.1, 1.1.30.2; the human still sees them at G3):

- **R-1:** bolt 011 (ITEM-117) runs after ITEM-121, because its search scope includes `docs/` and `README.md`. Before the dogfood, the history folders still hold old names, so the test would be red in W5. Bolt 011 requires 009, 010, 012 and 014.
- **R-3 (R8 amended):** AC-17.14 (the spike) is delivered whole by engine bolt 001. Lens bolt 010 consumes findings (c), (e), (h) and (i) through `requires_bolts: [001, …]` and does not start until the human accepts the spike hand-back. If finding (c) fails, it goes to the human as a new decision. Shown to the human at G3: "R8 amended: AC-17.14 owned whole by engine".
- **R-8:** `docs/follow-ups.md` is a project record. ITEM-121 moves it to `memory-bank/project/follow-ups.md` (new ITEM-121 AC-5). It is out of bolt 009's docs stage and out of bolt 011's fix scope.
- **O-4:** decided **Yes** (before bolt 008). The lens toast, deduplicated by text per session, plus one note per scan in the `/lens:gate` `skipped` list, counts as "one warning per lens scan" (AC-15.2). Bolt 008's AC-15.7 test asserts that two legacy reads in one scan give one log note, one `skipped` entry and at most one toast per session.
- **012 split (final):** 012 and 014. 012 builds `planMigration` as ordered planners, with the memory and settings entries empty, and fixes the whole dry-run `kind` enum; it requires `[002]` only. 014 requires `[001 (accepted), 012, 009, 010]`. ITEM-121 and 011 require both. 012 runs in W3 as the lowest-priority bolt, only 012 may edit `workflow.mjs` in W3, and it moves to W5 before 014 if it has not merged when 009's `requires_bolts` are merged and the spike hand-back is accepted. "The migration bolt" of AC-17.14 means 014 (C1, product-owner, step 1.1.30.1). The ids are `012-engine-migrate-plan` (working name 012a) and `014-engine-migrate-settings` (working name 012b); the id grammar does not change (C3, software-architect, step 1.1.30.2).
- **`time_box`:** a convention (`<n>d`) that `validate` does not check (C2, software-architect, step 1.1.30.2).
- **Early start:** bolts 007 and 008 may start once 004 is merged (the wave label stays W3). They must not edit `workflow.mjs`, the template or `orchestrator.md`.
- **G-FM:** one implementation in preview2 (`workflow.mjs`). The hook and the lens keep their preview1 front-matter readers. The known differences (the lens lowercases keys and accepts `[A-Za-z][\w-]*`; the hook strips no BOM) are a convergence note for ITEM-125.
- **D42:** this repository's `artifacts.handoffs` points at `execution-plans/` (feature 6). The self-hosting risk for run discovery is gone; 007 and 008 can be tested live here. Bolt 009 still breaks the local install, and the human re-registers the marketplace as `forgeline` when 009 merges.
- **Cost shifts (C-1 to C-7):** merge guard, `runs-root.mjs` and the one drift test in bolt 002; `tests/herdr` literals in bolt 004; `record.ts`, `runs-root.ts` and vector copies in 007 and 008; R-14 lines and engine-owned test literals in 009 (`.claude/settings.json` lines 3 and 113 stay for ITEM-121); lens-owned test literals, `identity.ts` and R-14 lens lines in 010. No AC changes.
- **Pending the human at G3:** a 2 to 4 hour session on days 1 and 2 of W1 for bolt 001; the Windows CI leg (ITEM-126 AC-15, a new AC in a frozen spec); 012 in W3 on the non-blocking rule, with W3 bolts running in parallel; ITEM-121 AC-6 (spec r1 text).

### ITEM-111: Foundations — memory-bank layout, vocabulary, status model, event schema, bolt-type mapping, path map and fallback rule (work item 1)
- **Type**: Feature
- **Priority**: P0
- **Status**: Backlog
- **Lifecycle**: ASDLC
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: research-assistant → software-architect + system-engineer (refine) → brutal-critique → G2 (human)

Work item 1, size L. FRs: FR-1, FR-2, FR-4 (mapping), FR-6 (schema design), FR-11 (path map), FR-15 (rule and warning channels). Depends on: none. Wave 0 (superseded by the task plan). The frozen spec is the contract every other work item reads; it settles C-4, C-5, C-7, C-8 and C-9 at G2. Bolt-type mapping preference (product-owner): bolt types are stage templates inside the eight lifecycles, not new lifecycles; decided at G2.

**Acceptance Criteria**
- [ ] AC-1 The contract defines a `memory-bank/` with exactly `product/` and `project/`, and a table giving each artifact type one path (no type twice, no path shared); the backlog is under `project/` (intent AC-1.1, 1.2, 1.3)
- [ ] AC-2 Run mechanics are in `execution-plans/` and reader-facing docs stay in `docs/` or the repo root; the contract says both (intent AC-1.4, 1.5)
- [ ] AC-3 The contract has one old-to-new path map covering the seven legacy `artifacts` keys, used by both migration and fallback (intent AC-1.6)
- [ ] AC-4 Intent, unit, bolt and story each have an id format with a worked example, folder or file name, required frontmatter keys and allowed statuses; a bolt's id equals its folder name (intent AC-2.1, 2.2)
- [ ] AC-5 One bolt-type list, one story status vocabulary, and the rule for which record wins when run state and frontmatter status disagree, with a worked example (intent AC-2.3 list, 2.4, 2.5)
- [ ] AC-6 Every specsmd inconsistency named in research 1.1.5 and its resolution is listed (intent AC-2.6)
- [ ] AC-7 Each bolt type defines ordered stages, owner agent per stage, the artifact each produces and its lifecycle(s); no new lifecycle is added; differences from `ddd-construction-bolt`, `simple-construction-bolt` and `spike-bolt` are stated with reasons; a spike bolt produces no production code (intent AC-4.1 to 4.4)
- [ ] AC-8 The event schema (five types: command, handoff, handback, verdict, escalation) and the file format are specified, including whether the handoff and hand-back records are the events (C-8) (intent AC-6.1 design)
- [ ] AC-9 The fallback rule is specified: new path wins, warning text and channel per tool, and the marker comment for fallback code, e.g. `fallback: remove in 1.0.0` (intent AC-15.2 to 15.4, 15.6, 15.8)
- [ ] AC-10 `brutal-critique` returns PASS on the spec and ADRs; the human approves G2

### ITEM-112: Memory-bank layout in tooling — `workflow.json` artifacts, schema, `workflow.mjs`, template, `init` (work item 2)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (includes code: `workflow.mjs`, tests)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer (docs in the change set go to brutal-critique)

Work item 2, size L. FRs: FR-1 (tooling), FR-8, FR-15 (`workflow.mjs` part), D11. Depends on: ITEM-111. Wave 1, parallel with ITEM-113. Files: `workflow.json` and schema, `workflow.mjs` (known artifact keys, unknown-key check), the plugin template, `init` folder creation, `tests/workflow/`. Bolt 002 also carries the `artifacts` merge guard (so `merge` and `upgrade` cannot flip a legacy or mixed repository to the preview2 layout early, C-2), the canonical grammar vectors `tests/fixtures/grammar/` including `runs-root.mjs`, the one convention-based drift test (C-4, C-5), and `tests/helpers/paths.mjs` for new tests only (C-1). The decision not to split `workflow.mjs` into `lib/` is final in 002's lld. No AC change.

**Acceptance Criteria**
- [ ] AC-1 The schema's `artifacts` properties and required list, `workflow.mjs`'s known keys and the plugin template agree on one key set; a test fails when they differ (intent AC-8.1)
- [ ] AC-2 In an empty git repository `/engine:init` creates `memory-bank/product/`, `memory-bank/project/` and `execution-plans/` and a `workflow.json` with the new paths, and `node .ai-dlc/workflow.mjs validate` exits 0 (intent AC-8.2)
- [ ] AC-3 The default `artifacts.handoffs` in the preview2 template points under `execution-plans/` (intent AC-5.1)
- [ ] AC-4 A preview1 `workflow.json` (legacy paths, no new keys) validates with exit 0, prints the fallback warning once on stderr, naming each legacy root used, the new path, the migration entry point and that the fallback ends in 1.0.0, and does not fail on the missing new keys (intent AC-8.4, 15.2, 15.3, 15.4)
- [ ] AC-5 `workflow.mjs` reads a legacy path when the new one is absent; when both exist it reads the new one and warns once, naming the ignored legacy root and the migration entry point; a run that neither reads nor ignores any legacy path emits no warning; tests cover each (intent AC-15.1, 15.3, 15.5, 15.6, 15.7 for `workflow.mjs`)
- [ ] AC-6 `validate` fails on an unknown `artifacts` key and on a bank artifact type whose path is outside `memory-bank/`; tests cover both (intent AC-8.5)
- [ ] AC-7 Fallback code carries the marker comment from the contract (intent AC-15.8)
- [ ] AC-8 `node --test "tests/**/*.test.mjs"` passes, output quoted by `sqa-engineer`

### ITEM-113: Authorship rule and `docs-status` rewrite — documentation-writer sole bank author, bank is documentation, done = engineering + knowledge (work item 3)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWH (agent artifacts, markdown only; orchestrator confirms the change kind per `aaw-review.md`)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → brutal-critique

Work item 3, size M. FRs: FR-7 (and the `docs-status` part of FR-8). Depends on: ITEM-111. Wave 1, parallel with ITEM-112. Files: the `docs-rules` template and skill, `.claude/rules/docs-status.md` with its `.github/instructions/` twin, the `review` skill, and the stage agents' Docs-update duty (`write-adr`, `spec-driven-development`, `product-planning`, `requirement-analysis`). Severity for a bank file written by another agent (intent C-10, decided by the product-owner): Blocker; `code-reviewer` cannot approve and `brutal-critique` returns REVISE. Text a build generates is exempt, and a stage agent returning content plus a *Docs update* request is not a violation.

**Acceptance Criteria**
- [ ] AC-1 The rewritten `docs-status` (template, repo copy and twin, identical bodies) lists every file under `memory-bank/` in its closed list of documentation (intent AC-7.1)
- [ ] AC-2 The rule says `documentation-writer` is the only agent that creates, edits or deletes files under `memory-bank/`, and stage agents return content plus a *Docs update* request (intent AC-7.2)
- [ ] AC-3 A hand-back from any other agent whose changed paths include a file under `memory-bank/` draws a Blocker finding that names the file and the agent when `code-reviewer` or `brutal-critique` reviews (`code-reviewer` cannot approve, `brutal-critique` returns REVISE); the rule and the `review` skill state it (intent AC-7.3)
- [ ] AC-4 `execution-plans/` is stated to be not documentation, written by the orchestrator or teammates (intent AC-7.4)
- [ ] AC-5 "Done" for a unit or bolt is defined as engineering complete and knowledge complete, with one worked example where engineering is done and knowledge is not (intent AC-7.5)
- [ ] AC-6 No skill that used to write a lifecycle artifact still instructs a stage agent to write under `memory-bank/` itself; a grep finds none (intent AC-7.6)
- [ ] AC-7 `brutal-critique` critiques every `documentation-writer` change under `memory-bank/` before the owning stage is `done` (intent AC-7.7)
- [ ] AC-8 `init` installs the rewritten rule into `.claude/rules/` and `.github/instructions/` (intent AC-8.3; verified end to end in ITEM-122)
- [ ] AC-9 `node tools/build-copilot.mjs --check` and `node tools/validate.mjs` pass, output quoted by `agent-manager`

### ITEM-114: Intents, units and bolts in the lifecycles and agents — unit-design and bolt-design stages (work item 4)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → brutal-critique (docs) / sqa-engineer → code-reviewer (code)

Work item 4, size XL. FRs: FR-2 and FR-3 (applied to the plugin), FR-4 (applied). Depends on: ITEM-111, ITEM-112, ITEM-115 (work item 5 runs first; they share the orchestrator, `agent-invocation`, `ai-dlc` and `task-triage` files). Wave 2, after ITEM-115 (superseded by the task plan). Split by lifecycle group at unit design: planning lifecycles vs build lifecycles. Files: `workflow.json` lifecycles and gates; `ai-dlc`, `request-routing`, `task-triage`, `product-planning` and `spec-driven-development`; product-owner, PM, analyst, architect, system-engineer, engineer and sqa prose.

**Acceptance Criteria**
- [ ] AC-1 `node .ai-dlc/workflow.mjs show` on the preview2 default lists a unit-design and a bolt-design stage in the lifecycles the contract names, each with an owner, `produces` and `critique: true` (intent AC-3.1)
- [ ] AC-2 Unit design feeds G2 and bolt design feeds G3; `show` lists each before its gate (intent AC-3.2)
- [ ] AC-3 The gate set equals preview1's (G1 to G4 and release go / no-go); no gate added or removed (intent AC-3.3)
- [ ] AC-4 `node .ai-dlc/workflow.mjs validate` passes on the preview2 default template (intent AC-3.4)
- [ ] AC-5 Every plugin file that names bolt types uses only the contract's list; a grep for each type id across `plugins/claude/engine/` finds only listed ids (intent AC-2.3)
- [ ] AC-6 Each bolt type's stage definitions from the contract appear in the lifecycles; the lifecycle list is still the eight named lifecycles plus the AAW variants, and a spike bolt is stated to produce no production code (intent AC-4.1, 4.2, 4.4)
- [ ] AC-7 Checks quoted by `agent-manager`: `node tools/build-copilot.mjs --check`, `node .ai-dlc/workflow.mjs validate`, `node --test "tests/**/*.test.mjs"` (if code changed)

### ITEM-115: Execution plans and typed events — `handoff` skill, `agent-invocation`, orchestrator run loop, event validation (work item 5)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (includes validator code and tests for events)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer (docs to brutal-critique)

Work item 5, size XL. FRs: FR-5, FR-6. Depends on: ITEM-111, ITEM-112 (it adds event-schema checks to `workflow.mjs`, which work item 2 also changes, so it runs after work item 2). Wave 2, before ITEM-114. Files: `handoff` skill (folder, naming, run state, session-handoff path, event types), `agent-invocation` briefs, orchestrator run loop, `herdr` references, and the `docs/handoffs/` literals in `tests/herdr/` (14 hits in 8 files; C-7). No AC change. Open: C-8 (records are the events), C-14 (remove or leave `.handoff/config.md`, a third-party artifact).

**Acceptance Criteria**
- [ ] AC-1 The `handoff` skill, `agent-invocation`, the orchestrator body and the generated `AGENTS.md` template name `execution-plans/` as the home of the execution plan, handoff records and hand-backs, run state versions and session handoffs (intent AC-5.2)
- [ ] AC-2 One `execution-plans/` folder per run, with the contract's naming; the execution plan and the run state record the intent, unit and bolt ids the run works on; the execution-plan file (name and required sections) is written by the orchestrator before the first spawn (intent AC-5.3, 5.4)
- [ ] AC-3 No ai-dlc file reads `.handoff/config.md` or `handoff_dir`; a grep in `plugins/` and `tools/` returns nothing (intent AC-5.5)
- [ ] AC-4 An event schema file exists, is installed by `init`, and its type field allows exactly `command`, `handoff`, `handback`, `verdict` and `escalation` (intent AC-6.1)
- [ ] AC-5 `validate` exits 0 for a run folder with a valid event file, and non-zero for an unknown type or a missing required field, naming the file and field (intent AC-6.2, 6.3)
- [ ] AC-6 Tests under `tests/workflow/` cover each event type plus the invalid cases, and `node --test "tests/**/*.test.mjs"` passes (intent AC-6.4)
- [ ] AC-7 Nothing reads or acts on events except `validate` and agent prose: the diff adds no hook entry, timer, watcher, scheduler or background process tied to events (intent AC-6.5)
- [ ] AC-8 The orchestrator body says, for each of the five event types, when it writes one and where (intent AC-6.6)

### ITEM-116: Hooks and lens read the new paths and names; fix `anomaly.ts` run.md-only drift (work item 6)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (code in `hooks/auto-handoff/` and `lens`)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer

Work item 6, size L. FRs: FR-9, FR-15 (hook and lens part). Depends on: ITEM-115. Bolts 007 (hook) and 008 (lens); each may start once bolt 004 is merged, W3 (see the task plan). Neither edits `workflow.mjs`, the template or `orchestrator.md`. Each adds `record.ts` and `runs-root.ts` and its byte copies of the canonical vectors; no G-FM implementation (C-3, C-6). C-9 has two senses. The toast-deduplication sense is closed: O-4 was decided Yes (D43), and bolt 008's AC-15.7 test covers it (see the O-4 note in this milestone's decisions list, near the top of this file). Code: auto-handoff `run.ts` root and record parsing and its tests (about 71 hits); lens `anomaly.ts`, `lens.ts`, `register.tsx`, settings and tests (about 201 in `lens.test.tsx`). Still open, the second sense of C-9: confirm that the "drift" is the hard-coded `run.md` in `anomaly.ts:263` and the settings text.

**Acceptance Criteria**
- [ ] AC-1 Given a run folder under `execution-plans/` with an active run state, the auto-handoff hook finds and names that run; a test in `hooks/auto-handoff/tests/` covers it (intent AC-9.1)
- [ ] AC-2 Given the same folder, lens lists the run and its stages and its anomaly scan reports a blocked step; a test under `plugins/claude/lens/tests/` covers each (intent AC-9.2)
- [ ] AC-3 A run folder holding only `run.v2.md` with no front matter gives a skipped message that names `run.v2.md`, not `run.md`; settings text and code comments say "run state"; a test covers the message (intent AC-9.3)
- [ ] AC-4 Given only a legacy `docs/handoffs/` run folder, the hook and the lens still read it and emit the fallback warning through their existing non-blocking notice channel, once per invocation however many files they read, naming the legacy root, the new path, the migration entry point and the 1.0.0 end date (intent AC-9.4, 15.2 to 15.4)
- [ ] AC-5 No warning when no legacy path is read or ignored; when both exist the new path wins and one warning names the ignored legacy root and the migration entry point; tests cover each for the hook and the lens (intent AC-15.3, 15.5, 15.6, 15.7)
- [ ] AC-6 `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine` and `… ./plugins/claude/lens` pass, output quoted; every change under `hooks/auto-handoff/` and `hooks/keepalive/` has an entry in that folder's `ATTRIBUTION.md` (intent AC-9.5)
- [ ] AC-7 Fallback code carries the marker comment (intent AC-15.8)

### ITEM-117: Path sweep — no stale `docs/...` references in plugin prose, templates, rules and Copilot build (work item 7)
- **Type**: TechDebt
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (adds a stale-path test; sweeps agent artifacts and generated files)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer (docs to brutal-critique)

Work item 7, size L. FRs: FR-10, FR-16 (build parity). Bolt 011 requires bolts 009, 010, 012 and 014 and runs after ITEM-121 (R-1), in W6. The lens's legacy-path strings are changed earlier, in bolt 008. A hit in a lens-owned path goes back to the lens unit as a fix round of bolt 010. `docs/follow-ups.md` is not in its scope (it moves in ITEM-121). Fix volume is unknown until it runs (estimate range 1 to 3.5 d). No AC change. Scope: hard-coded `docs/...` in about 39 plugin files, `tools/templates/AGENTS.template.md`, `AGENTS.md` and `CLAUDE.md` templates, `.claude/rules`, herdr fixtures, regenerated Copilot build.

**Acceptance Criteria**
- [ ] AC-1 A check in `node --test "tests/**/*.test.mjs"` searches `plugins/claude/engine/`, `plugins/copilot/engine/`, `plugins/claude/lens/`, `tools/templates/`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.claude/rules/` and `.github/instructions/` for the seven legacy path prefixes and fails on any hit not on the allowlist (intent AC-10.1)
- [ ] AC-2 The allowlist is one file; each entry is a path or glob with a one-line reason, limited to fallback code and tests, migration code, tests and fixtures, and reader-facing pages under `docs/` (intent AC-10.2)
- [ ] AC-3 Adding `docs/specs/x.spec.md` to an agent file makes the check fail and name that file and line (intent AC-10.3)
- [ ] AC-4 The check does not flag reader-facing paths such as `docs/plugins.md` and `README.md` (intent AC-10.4)
- [ ] AC-5 `node tools/build-copilot.mjs --check` passes after `node tools/build-copilot.mjs`, and changed agents and generic skills contain no stack-specific terms outside a stack-routing table (intent AC-16.1, 16.3)

### ITEM-118: Migration path for existing repositories — a skill shipped with the engine plugin moves `docs/` artifacts and `docs/handoffs/` and rewrites the settings files (work item 8)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (code, skill and fixtures)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer (docs to brutal-critique)

Work item 8, size L. FRs: FR-11, FR-15 (documented fallback), FR-17 (the migration's rename handling, D25). Depends on: ITEM-111, ITEM-112, ITEM-115 (may start once ITEM-112 and the naming contract are frozen); its FR-17 rename handling waits for the AC-17.14 spike's accepted hand-back (ITEM-126), which is why bolt 014 requires 001 accepted, 009 and 010, while bolt 012 requires only 002. Delivered by two bolts. 012 (W3, lowest priority, non-blocking; moves to W5 before 014 if not merged when 009 is ready): intent AC-11.2 to 11.9 and AC-11.11, that is ITEM-118 AC-2 to AC-10. 014 (W5): intent AC-11.1 (the skill, ITEM-118 AC-1) and AC-11.x settings rewrite (ITEM-118 AC-11), plus ITEM-126 AC-10 and AC-12. Fixtures F1 to F6, F12 and F13 (a mixed block with `docs/handoffs/` and `execution-plans/` both non-empty, D42) are 012's; F7 to F11 are 014's. No AC text changes. Needs fixture repos. Open: C-7 (name and behaviour of the migration skill shipped with the engine plugin, D25; proposed: `/engine:migrate [--dry-run]`, confirmed by the human at G2). The migration also rewrites the repository's `.claude/settings.json` and `.claude/settings.local.json` (D25; ITEM-126 AC-10). The dry-run mode is decided (intent C-11, P1) and is AC-10 below.

**Acceptance Criteria**
- [ ] AC-1 A migration entry point, a skill shipped with the engine plugin (proposed: `/engine:migrate [--dry-run]`; name fixed in the contract), exists and is described in a reader-facing guide under `docs/` (intent AC-11.1)
- [ ] AC-2 On a preview1 fixture with files at all seven legacy paths, every file ends at its mapped path, the moved count is unchanged, `workflow.json` `artifacts` uses the new paths and `validate` exits 0 with no fallback warning (intent AC-11.2)
- [ ] AC-3 `git log --follow <new path>` shows pre-move commits for at least one file per artifact type in the fixture (intent AC-11.3)
- [ ] AC-4 A second run on the migrated fixture changes nothing (`git status` clean) (intent AC-11.4)
- [ ] AC-5 When a target path exists with different content the migration stops non-zero, changes nothing and names the path (intent AC-11.5)
- [ ] AC-6 A fixture with custom `artifacts` paths migrates from those paths, not the defaults (intent AC-11.6)
- [ ] AC-7 A fixture with both layouts present is merged without overwriting any existing file (intent AC-11.7)
- [ ] AC-8 Reader-facing docs (README files, `docs/plugins.md`, release notes) are not moved (intent AC-11.8)
- [ ] AC-9 Tests for AC-2 to AC-8 run in `node --test "tests/**/*.test.mjs"` and pass, output quoted (intent AC-11.9)
- [ ] AC-10 A dry-run flag lists every planned move, settings rewrite and conflict (as AC-5 would report them), changes nothing (`git status` clean), and exits 0 when there is no conflict and non-zero otherwise; a test in `tests/` covers it (intent AC-11.11, P1)
- [ ] AC-11 The migration rewrites `agent`, the marketplace key and the plugin keys in `.claude/settings.json` and `.claude/settings.local.json` (an absent `settings.local.json` is skipped), and leaves user-scope and managed settings untouched; tests cover it through the skill's entry point (intent AC-17.10 (g), D25); it also rewrites `ai-dlc:<id>` prefixes in permission and other string values, and leaves an `"ai-dlc@<other>"` key (any marketplace other than `ai-dlc-agent-workflow`) unrewritten with one `advice:` line and without applying the prefix rules to that file (intent AC-17.10 (h), (i)) (added after critique 1.5.l3.7; approved at G2)

### ITEM-119: Attribution and licence — NOTICE, THIRD_PARTY_NOTICES, ATTRIBUTION for the adapted specsmd material (work item 9)
- **Type**: TechDebt
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWH (notice and attribution files; orchestrator confirms the change kind; promote to AAWP if the Copilot build copies code)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → brutal-critique

Work item 9, size S. FRs: FR-12. Depends on: none (confirm the adapted-file scope in spec 001; finalise after ITEM-114 and ITEM-115). Wave 0 (superseded by the task plan). Priority raised from P2 to P1 by the product-owner because it is licence compliance. Open: C-13 (does `build-copilot.mjs` copy plugin-root NOTICE files into `plugins/copilot/engine/`).

**Acceptance Criteria**
- [ ] AC-1 `THIRD_PARTY_NOTICES.md` has an entry for fabriqaai/specs.md: MIT, "Copyright (c) 2025 Fabriqa AI", the upstream URL and the full MIT licence text (intent AC-12.1)
- [ ] AC-2 `plugins/claude/engine/` and the generated `plugins/copilot/engine/` each contain a NOTICE (or equivalent) and an ATTRIBUTION record listing each file that adapts specsmd material and what was adapted (intent AC-12.2)
- [ ] AC-3 Every file the contract or later units mark as adapted from specsmd appears in the ATTRIBUTION record; the two lists match (intent AC-12.3)
- [ ] AC-4 The release is not tagged while AC-1 to AC-3 fail (intent AC-12.4)

### ITEM-120: Brand-name clash research — `forgeline`, `engine`, `lens` (work item 10)
- **Type**: Feature
- **Priority**: P3
- **Status**: Backlog
- **Lifecycle**: research-assistant only (no lifecycle; no repository change)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: research-assistant

Work item 10, size S. FRs: FR-13 (research only, P3, non-gating; retargeted to `engine`, `lens` and `forgeline` (D30, D31, D32; generic plugin names, so a namespace collision with other plugins of the same name is checked too; note the 1.1.8 finding of a similar-named private-beta product, "Forgeline"); the rename itself is FR-17, ITEM-126). Depends on: none. Wave 0, parallel, not release-gating. A clash found goes to the human as a new decision.

**Acceptance Criteria**
- [ ] AC-1 A research report exists covering at least the names in research 1.1.8 A, plus `engine`, `lens` (D32, D31; with a namespace-collision check) and `forgeline` (fixed by D30, which supersedes D21; the 1.1.8 "Forgeline" private-beta finding is checked explicitly), and for each records web search findings, USPTO/EUIPO, npm, GitHub org and Claude Code and Copilot marketplace checks (or states each was unreachable), and a verdict (intent AC-13.1)
- [ ] AC-2 The report does not decide the name: the release ships the names FR-17 fixes; a tester confirms the report's verdicts change no file outside the report itself (intent AC-13.2)
- [ ] AC-3 Release proceeds with the report missing (intent AC-13.3)

### ITEM-121: Dogfood — migrate this repository's own `docs/` and `docs/handoffs/` to `memory-bank/` and `execution-plans/` (work item 11)
- **Type**: TechDebt
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (runs the migration from ITEM-118 on this repo; touches `workflow.json` and moves files)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer, plus a documentation-writer stage for AC-3 (the backlog merge)

Work item 11, size M. FRs: FR-11 (this repo). Depends on: ITEM-118. W6, first (after bolt 014), before bolt 011 and ITEM-122. Priority raised from P2 to P1 and made a preview2 must (D12). This run's planning artifacts are already in `memory-bank/` and `execution-plans/` (D8); this item moves the legacy history. It moves `docs/backlog/backlog.md` (ITEM-001 to ITEM-110) into this file.

**Acceptance Criteria**
- [ ] AC-1 The migration (ITEM-118) has been run on this repository before release go / no-go; the hand-back quotes the migration command and its output (intent AC-11.10)
- [ ] AC-2 After it, no file remains under the seven legacy paths (reader-facing `docs/` pages excepted) and `.ai-dlc/workflow.json` uses the new paths (intent AC-11.10)
- [ ] AC-3 `docs/backlog/backlog.md` is merged into `memory-bank/project/backlog.md` with ITEM-001 to ITEM-110 unchanged and no duplicate ids. This is a content merge, not a pure `git mv`, so it is not exempt from the single-author rule: `documentation-writer` writes it in its own stage, and `product-manager` owns the content (D2, D10, C-10) (item-level, no intent AC)
- [ ] AC-4 The repo checks pass with no fallback warning in their output (intent AC-11.10)
- [ ] AC-5 `docs/follow-ups.md` is moved to `memory-bank/project/follow-ups.md` by a pure `git mv` (exempt from the single-writer rule; `git log --follow` shows its history). In the same ITEM-121 stage `documentation-writer` updates its four items, which cite `plugins/claude/ai-dlc/...` and `.ai-dlc` paths that are stale after the rename, so the sweep (bolt 011, intent AC-17.3, AC-17.4) needs no allowlist entry for it. After the move `docs/follow-ups.md` no longer exists and is not in the sweep scope. It is not touched by bolt 009's docs stage (R-8, decided in steps 1.1.25 and 1.1.25.1; item-level, no intent AC)
- [ ] AC-6 The dogfood run refreshes `.ai-dlc/workflow.mjs` and the schema, runs `migrate` including the settings rewrite of `.claude/settings.json` (lines 3 and 113: the `agent` value and the marketplace key, left alone by bolt 009) and quotes the rewrite, and refreshes the `init` managed block of `AGENTS.md`, which removes the interim D42 sentence about `docs/handoffs/` runs (spec §16 W6 text, revision r1; intent AC-11.10; **pending acceptance with the revised spec at G3**)

### ITEM-122: Integration and regression — full checks, fresh `init` and migrated-repo walk-throughs (work item 12)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: TLC
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: sqa-engineer → code-reviewer

Work item 12, size M. FRs: FR-8 to FR-11, FR-14 (checks), FR-16. Depends on: ITEM-116, ITEM-117, ITEM-118, ITEM-121. W6, after bolt 011. Owner: `sqa-engineer`, who runs each command and quotes its real output.

**Acceptance Criteria**
- [ ] AC-1 These pass, each quoted with real output: `node --test "tests/**/*.test.mjs"`, `node tools/build-copilot.mjs --check`, `node tools/validate.mjs`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/engine`, `npx @anthropic-ai/claude-code plugin test ./plugins/claude/lens` (intent AC-14.3, 16.1, 16.5). This item also closes AC-16.3 (no stack terms, a bolt Definition-of-Done item, R-2) and the full AC-12.3 comparison
- [ ] AC-2 A fresh `init` repo (intent AC-8.2, 8.3) and a migrated preview1 repo (intent AC-11.2) each complete one documented smoke walk-through with no error; the hand-back quotes steps and output (intent AC-14.7)
- [ ] AC-3 Claude-only skills are in `tools/claude-only-skills.json` and absent from `plugins/copilot/engine/`; the lens command skills live in the lens plugin and the engine keep-alive skill stays listed (intent AC-17.13); `lens` stays only in `.claude-plugin/marketplace.json` (intent AC-16.2)
- [ ] AC-4 The diff against `47a3480` shows no rename or removal of a `.ai-dlc/` path or an `AI_DLC_*` variable; the plugin names (`engine`, `lens`; D32, D31), prefixes, marketplace name, lens command names and lens pane ids (`lens-*`, D33, D37) are covered by ITEM-126 (intent AC-16.4)

### ITEM-123: Docs and release notes — README files, `docs/plugins.md`, migration guide, release notes (work item 13)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: documentation-writer stage (no lifecycle); critique by brutal-critique
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: documentation-writer ↔ brutal-critique

Work item 13, size M. FRs: FR-14 (docs). Depends on: ITEM-122 (and ITEM-121, which must ship). W6, after ITEM-122. The reader pages pick up the new names in the docs stage of the bolt whose work changes them (R-9: 004 run-folder text, 009 engine names, 010 lens names, 014 the migrate entry); this item keeps the upgrade guide with the stored-data warning (D23), the release notes and the AC-17.8 verification. Reader-facing docs stay in `docs/` (D11). Status markers follow `docs-status` and the run state.

**Acceptance Criteria**
- [ ] AC-1 Release notes under `docs/` describe the layout move, the migration entry point, the one-release fallback and its removal in 1.0.0, and that preview2 is a breaking release (intent AC-14.4)
- [ ] AC-2 The README files and `docs/plugins.md` describe `memory-bank/`, `execution-plans/`, intents, units, bolts and typed events as done, with no leftover *planned* or *in progress* marker once the last review stage is done (item-level, no intent AC)
- [ ] AC-3 The migration guide (ITEM-118 AC-1) is present and consistent with the migration's behaviour (item-level, no intent AC)
- [ ] AC-4 `brutal-critique` returns PASS on all changed documents (item-level, no intent AC)

### ITEM-124: Release 1.0.0-preview2 — version bump, release gate, go / no-go, publish
- **Type**: Release
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: release (product-manager release gate → product-owner go / no-go → devops-engineer)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: product-manager → product-owner → devops-engineer

FRs: FR-12 (gate), FR-14. Depends on: ITEM-111 to ITEM-119, ITEM-121 to ITEM-123 and ITEM-126 (FR-17, release-gating) Done (ITEM-120 excepted, P3). ITEM-124 closes AC-16.1 (`build-copilot.mjs --check`) and AC-16.5 (`node tools/validate.mjs`), which are bolt Definition-of-Done items (R-2); `1.0.0-preview1` tagged first (D7, intent AC-14.1; decision C-12): no preview2 change is merged into the preview1 release line before then, and the version-bump merge is the last of these merges. W6, last.

**Acceptance Criteria**
- [ ] AC-1 No preview2 change is merged into the preview1 release line before `1.0.0-preview1` is tagged (intent AC-14.1)
- [ ] AC-2 The version is `1.0.0-preview2` in `plugins/claude/engine/.claude-plugin/plugin.json`, the generated Copilot manifest and both marketplace entries (intent AC-14.2)
- [ ] AC-3 The release hand-back quotes the five repo checks (ITEM-122 AC-1) plus `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/engine` and `… --strict .`, each with output showing success (intent AC-14.3)
- [ ] AC-4 Every milestone item is Done except ITEM-120 (P3) and ITEM-125 (milestone 1.0.0); no open P0 (intent AC-14.5)
- [ ] AC-5 ITEM-119 AC-1 to AC-3 pass before the tag (intent AC-12.4)
- [ ] AC-6 G4 is approved by the human and go / no-go is recorded by `product-owner` in the run state before the tag (intent AC-14.6)
- [ ] AC-7 A Docs update request for the release notes is in the hand-back (ITEM-123 covers it) (item-level, no intent AC)

### ITEM-126: Rename — plugins `engine` and `lens`, marketplace `forgeline`, lens commands (FR-17)
- **Type**: Feature
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: to be set at G3 (placeholder)
- **Milestone**: 1.0.0-preview2
- **Added**: 2026-11-13
- **Agent Chain**: to be set at G3 (placeholder)

Placeholder for FR-17 (D15-D25, D28, D29, D30–D37), release-gating. Delivered by bolts 001, 009, 010, 011 and 014 of the task plan (engine and lens units, D14; bolt 011 in W6, after ITEM-121); the AC-17.14 spike runs first and the migration bolt (014, C1) waits for its accepted hand-back. Depends on: spec 001 (the contract) and the G2 decisions.

**Acceptance Criteria**
- [ ] AC-1 Plugin `name` `engine` (D32) and the lens plugin `name` `lens` (D31), `displayName` kept, `keywords` are `specsmd`, `ai-dlc`, `forgeline`, `agentic-sdlc` (D35, D36), both marketplaces named `forgeline` (D30; intent AC-17.1)
- [ ] AC-2 The five repo checks and the three `plugin validate --strict` runs pass, quoted; the old plugin folders no longer exist (intent AC-17.2)
- [ ] AC-3 The old-name check runs in `node --test "tests/**/*.test.mjs"` and fails on any non-allowlisted old-name hit (intent AC-17.3)
- [ ] AC-4 The allowlist holds only the four permitted categories (intent AC-17.4)
- [ ] AC-5 Hooks-module command constants are `engine:cache-keepalive`, `:cache-keepalive-configure` and the engine keep-alive command that replaces `lens-keepalive` (D24; proposed `engine:cache-keepalive-lens`, name confirmed by the human at G2); `plugin test ./plugins/claude/engine` passes (intent AC-17.5)
- [ ] AC-6 `init` writes `"agent": "engine:orchestrator"` and creates `engine-<agent>` memory folders (intent AC-17.6)
- [ ] AC-7 `workflow.mjs catalog` records `engine`; `validate` exits 0 (intent AC-17.7)
- [ ] AC-8 Install, upgrade and lens command documentation show the new names, the stored-data warning and the old-to-new lens table, which says keep-alive stays in the engine (proposed `/engine:cache-keepalive-lens [on|off]`) (intent AC-17.8; written via ITEM-123)
- [ ] AC-9 This repository is migrated before go / no-go (intent AC-17.9)
- [ ] AC-10 The migration skill's rename handling, including the settings-file rewrite, is covered by tests (a) to (i) (intent AC-17.10; D25); (h) permission and other string values carrying an `ai-dlc:<id>` prefix are rewritten by the prefix rules of spec §10, and (i) a fixture with `"ai-dlc@<other>"` (any marketplace other than `ai-dlc-agent-workflow`) is not rewritten, `migrate` prints one `advice:` line for it, and the prefix rules are not applied to that file (added after critique 1.5.l3.7; approved at G2)
- [ ] AC-11 The lens accepts `ai-dlc:` and `engine:` for one release, marked `fallback: remove in 1.0.0` (intent AC-17.11; lens unit)
- [ ] AC-12 `validate` emits one detect-and-warn message for old memory folders or `ai-dlc:` `agent` values (intent AC-17.12)
- [ ] AC-13 Five `lens*` skills live in `plugins/claude/lens/skills/` as `show`, `configure`, `init`, `kit` and `gate`, and the lens hooks module registers exactly those five lens commands (each equal to `lens:<folder>`), and additionally answers the engine keep-alive command (proposed `engine:cache-keepalive-lens`), which is not a lens skill and is excluded from the folder-name test; the keep-alive command stays in the engine (proposed: the separate skill `cache-keepalive-lens`; if merged at G2, `cache-keepalive` itself), keeps today's behaviour (toggles the lens setting `keepaliveSection`, answered by the lens hooks module) and is listed in `tools/claude-only-skills.json`; `/engine:init` and `/lens:init` are separate (intent AC-17.13; D24; lens unit for the five)
- [ ] AC-14 The spike runs first and its hand-back records (a), (b) and (c), and (d)–(i) as listed in spec §16 (bolt 001) (intent AC-17.14; bolt 001, engine; finding (c) is consumed by lens bolt 010 per R-3)
- [ ] AC-15 CI runs the repository tests on Windows as well: `.github/workflows/validate.yml` has a `windows-latest` job that runs `node --test "tests/**/*.test.mjs"`, added in bolt 009 (engine story 018, proposed), about 0.25 d. Assumption: the existing suite is green on Windows. If the job exposes failures, fixing them is out of scope and the job keeps running `node --test` on the tests present at 009's merge, the bolt's hand-back reports the Windows failures, and the product-owner decides the follow-up (step 1.1.27; item-level, no intent AC; **new AC in a frozen spec: pending the human's acceptance at G3**)

---

## Milestone 1.0.0 — follow-ups from preview2

### ITEM-125: Remove the `docs/` fallback in 1.0.0
- **Type**: TechDebt
- **Priority**: P1
- **Status**: Backlog
- **Lifecycle**: AAWP (removes code in `workflow.mjs`, the auto-handoff hook and the lens; updates skills and docs)
- **Milestone**: 1.0.0
- **Added**: 2026-11-13
- **Agent Chain**: agent-manager → sqa-engineer → code-reviewer (docs to brutal-critique; docs text via documentation-writer)

FR-15, D9 (one release of read fallback). Depends on: ITEM-124 (preview2 released). Scope: every fallback code path carries the marker comment `fallback: remove in 1.0.0` from the contract; the list of files comes from a grep for that marker (intent AC-15.8, 14.5). The scope includes the FR-17 fallback code, both marked `fallback: remove in 1.0.0`: the lens agent-type prefix fallback that accepts `ai-dlc:` for one release (intent AC-17.11) and the `validate` detect-and-warn code for old memory folders and `ai-dlc:` `agent` values (intent AC-17.12). Work item 1's contract fixes the marker comment; work items 2 and 6 add the file list to this item as they land. It also records the G-FM convergence note (C-3): in preview2 only `workflow.mjs` implements G-FM; the lens `frontMatter` lowercases keys and accepts `[A-Za-z][\w-]*`, and the hook `parseRunState` strips no BOM. A code base that starts reading bank-file front matter adopts G-FM and joins the vector set with a byte copy.

**Acceptance Criteria**
- [ ] AC-1 The preview2 backlog lists the files holding the marker comment, and a grep for the marker finds none after this item (intent AC-15.8)
- [ ] AC-2 `workflow.mjs`, the auto-handoff hook and the lens no longer read the seven legacy paths or emit the fallback warning; their tests are updated and pass
- [ ] AC-3 The stale-path check (ITEM-117) drops the fallback-code allowlist entries, and `node --test "tests/**/*.test.mjs"` passes
- [ ] AC-4 A repository still on legacy paths gets a clear error that names the migration entry point (not a silent failure) (item-level, no intent AC)
- [ ] AC-5 Release notes and the migration guide say the fallback is removed (*Docs update* to `documentation-writer`)
