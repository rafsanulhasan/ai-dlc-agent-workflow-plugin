# Product Backlog — AI-DLC Agent Workflow

Maintained by `product-manager` through the `product-planning` skill. Priorities: P0 critical blocker · P1 high · P2 medium · P3 low.

<!-- Items use this shape:

### ITEM-001: <Title>
- **Type**: Feature | Bug | Security | TechDebt | Release
- **Priority**: P0 | P1 | P2 | P3
- **Status**: Backlog | In Progress | Review | Done | Cancelled
- **Lifecycle**: AI-DLC | PDLC | ASDLC | STBLC | FDLC | BFLC | RLC | TLC | CRLC
- **Milestone**: <version or "Unplanned">
- **Added**: YYYY-MM-DD
- **Agent Chain**: <e.g. requirement-analyst → software-architect → software-engineer → sqa-engineer>

**Acceptance Criteria**
- [ ] AC-1 <verifiable condition>
-->

### ITEM-001: Configurable review limits per loop (maxRounds / maxFailures)
- **Type**: Feature
- **Priority**: P2
- **Status**: Done
- **Lifecycle**: AAW
- **Milestone**: 1.0.0-preview1
- **Added**: 2026-10-22
- **Agent Chain**: agent-manager → brutal-critique / sqa-engineer → code-reviewer

Done 2026-10-22 in commit 85b53e8. Every review loop carries maxRounds and maxFailures (default 2 / 1), overridable by three env pairs; `rounds --json` reports the limits in effect. Runs: `docs/handoffs/AAW-20261022-review-rounds-workflow-skill/`, `AAW-20261022-review-rounds-consumers/`, `AAW-20261022-review-rounds-agent-manager/`.

**Acceptance Criteria**
- [x] AC-1 Each review loop has maxRounds and maxFailures with defaults 2 / 1
- [x] AC-2 Three env pairs override the limits
- [x] AC-3 `rounds --json` reports the limits in effect

### ITEM-002: Fix 7 Minor wording findings from the final critiques of the review-limits runs
- **Type**: TechDebt
- **Priority**: P3
- **Status**: Backlog
- **Lifecycle**: AAW
- **Milestone**: Unplanned
- **Added**: 2026-10-22
- **Agent Chain**: agent-manager → brutal-critique

Source: "Gates and loops" in `docs/handoffs/AAW-20261022-review-rounds-workflow-skill/run.md` and `docs/handoffs/AAW-20261022-review-rounds-consumers/run.md`.

**Acceptance Criteria**
- [ ] AC-1 All 7 Minor wording findings are fixed or explicitly declined with a reason
- [ ] AC-2 brutal-critique returns PASS on the changed docs

---

## FEAT-20261020-ai-dlc-lens — one lens dashboard (savvy-progress + cache-tax + context-view + agent-flow, flowchart view)

Source: `docs/handoffs/FEAT-20261020-ai-dlc-lens/00b-approved-plan-2026-10-22.md`; breakdown step 4.1 (2026-10-22), revised step 9.2 (2026-10-22) for `docs/product/ai-dlc-lens/brief.md` section 13. Binding for routing. ITEM-003 to ITEM-029 share Type Feature unless stated, Milestone **1.0.0-preview1** (every item, no cut line; human decision C1), Added 2026-10-22, Status Backlog. Stories: `docs/product/ai-dlc-lens/stories.md` (US-1 to US-21); each item's ACs are its stories' ACs there, not copied here.

**Triage states:** `ready-for-agent` · `ready-for-human` (a gate or a manual check) · `needs-info` (ACs settle at G1, design at G2).
**External blocker (EXT):** run `AAW-20261022-fold-cache-keepalive` (branch `fix/auto-handoff-chain`) must merge to `main`, then `main` merges into `feat/ai-dlc-lens`. Items marked EXT touch `hooks/auto-handoff/`, `plugin.json`, `marketplace.json`, `.github/workflows/validate.yml`, `THIRD_PARTY_NOTICES.md` or `CLAUDE.md`, all modified there. It blocks the build waves and spike 028 only; planning waves and spikes 027 and 029 run now.

| ID | Item | Pri | Stories | Lifecycle | Chain | Blocked by | Group | Wave | Triage |
|---|---|---|---|---|---|---|---|---|---|
| 003 | Research: open technical questions (step 5) | P1 | — | research | research-assistant | — | — | P1 | ready-for-agent |
| 004 | Plan: brief, stories, numbered ACs (G1) | P1 | all | PDLC | product-owner → requirement-analyst; DW ↔ BC | 003 | — | P2 | ready-for-agent |
| 027 | Spike (a): VS Code panel resize, Svg animation, buttons and card nesting in transcript rows (scratch mod, throwaway) | P1 | US-12, US-14, US-15 | AAW | agent-manager; manual VS Code check by the human (2.1.299 or later) | 004 (G1) | S | S1 | ready-for-agent |
| 029 | Spike (c): avatar image render (path, `data:` URI) and Svg `<style>` / `<marker>` / `<image>` scrub (scratch mod, throwaway) | P1 | US-13 | AAW | agent-manager; manual VS Code check by the human | 004 (G1) | S | S1 | ready-for-agent |
| 028 | Spike (b): keep-alive state read across plugins (`$.tool.register` / `$.tool.call`, or a documented state file); conditional on the fold merge | P1 | US-9 | AAW | agent-manager | 004 (G1), EXT | — | S2 (only if EXT merged before G2) | needs-info |
| 005 | Spec, ADRs, low-level design (G2); cites each spike result; any spike still open is an open question with its fallback | P1 | all | ASDLC | software-architect + system-engineer; BC | 004 (G1), 027, 029, 028 or its open question | — | P3 | ready-for-agent |
| 006 | Task plan, no cut line; re-estimate of the whole plan and critical path marked (G3) | P1 | — | STBLC | product-manager | 005 (G2) | — | P4 | ready-for-agent |
| 007 | WI-4a: shared `runstate` parser, extracted from `hooks/auto-handoff/run.ts` | P1 | US-1 | AAW | agent-manager → sqa → code-reviewer | 006, EXT | A | B1 | needs-info |
| 008 | WI-4b: `workflow.mjs runs [--json] [--active]` + `node:test` fixtures | P1 | US-2 | AAW | same | 007 | — | B2 | needs-info |
| 009 | WI-5: gate-alert hook, installed by `init` | P2 | US-3 | AAW | same | 008 | — | B3 | needs-info |
| 010 | WI-6a: ai-dlc-lens plugin scaffold, manifest, marketplace entry (location per G2) | P1 | US-4 | AAW | same | 006, EXT | A | B1 | needs-info |
| 011 | WI-6b: `build-copilot.mjs` ignores the lens plugin; CI validate and test steps pinned to one Claude Code version | P1 | US-4 | AAW | same | 006, EXT, 010 | — | B2 | needs-info |
| 012 | WI-6c: settings resolver (settings.local env > settings env > user level > defaults; invalid ignored) | P1 | US-5 | AAW | same | 010 | B | B2 | needs-info |
| 013 | WI-6d: data model + compact view, tracer bullet (agents, edges, loops, usage; savvy rows, task bar); owns the single dated price table (est. spend, AC-7.6, AC-7.7) | P1 | US-7 | AAW | same | 007, 010 | B | B2 | needs-info |
| 014 | WI-6e: merged header: context meter, cache-tax figures, keep-alive state (read only; source per spike 028 or its fallback), opt-in guard; no keepwarm | P1 | US-8, US-9, US-10, US-11 | AAW | same | 012, 013 (price table), 028 result or fallback via 005 | C | B3 | needs-info |
| 015 | WI-6f: flowchart view (Svg, dock + wide, arrows, loop two-way, blink, one chart per workflow; avatar image per spike 029) | P1 | US-12, US-13 (avatar) | AAW | same | 013, 027, 029 (via 005) | C | B3 | needs-info |
| 016 | WI-6g: pane collapse / `[+]` expand, attention flags, inline-mode filter, field-uniqueness test | P1 | US-14 | AAW | same | 014, 015, 027 (via 005) | — | B4 | needs-info |
| 017 | WI-6h: transcript cards (response text never hidden; setting turns off; no `session.append`) | P2 | US-15 | AAW | same | 012, 013, 027 (via 005) | C | B3 | needs-info |
| 018 | WI-6i: text fallback `/ai-dlc:lens text` | P2 | US-16 | AAW | same | 013 | C | B3 | needs-info |
| 019 | WI-6j: `lens-init` / `lens-configure` writers with path trust check (stays P1) | P1 | US-6, US-13 (trust check) | AAW | same | 012, 029 (via 005) | C | B3 | needs-info |
| 020 | WI-6k: per-agent / per-stage ledger, report view; reads the price table owned by 013 and shows its date | P2 | US-17 | AAW | same | 013 (price table) | C | B3 | needs-info |
| 021 | WI-6l: upstream LICENSE files, NOTICE, ATTRIBUTION, THIRD_PARTY_NOTICES (4 notices) | P1 | US-18 | AAW | same | 003 (agent-flow copyright), EXT | A | B1 | needs-info |
| 022 | WI-6m: three thin Claude-only skills `lens`, `lens-init`, `lens-configure` in ai-dlc | P1 | US-19 | AAW | same | 010, 011 | C | B3 | needs-info |
| 023 | WI-6n: `plugin-management` skill, rules, CLAUDE.md for the new layout | P2 | US-20 | AAW | same | 010, 011, 022, EXT | — | B4 | needs-info |
| 024 | WI-7: lens README, recommended-mods page with trust warning, settings table | P2 | US-21 | AAW | documentation-writer ↔ brutal-critique | 016-020, 022 | — | B5 | needs-info |
| 025 | Review report (G4): code-reviewer ×2 (standards, spec) + manual VS Code check (M6) | P1 | all | CRLC | code-reviewer ×2 | 007-024 | — | R1 | ready-for-human |
| 026 | Release: go / no-go, then publish | P1 | — | Release | product-owner → devops-engineer | 025, no open P0 | — | R2 | ready-for-human |

**Waves.** P1: 003 (running) · P2: 004 → G1 · **S1 (after G1, parallel): 027 ∥ 029, then the human's manual VS Code check** · **S2: 028, only if the fold merge has landed before G2; otherwise it stays open and 005 lists it as an open question with a fallback (F6 omits the keep-alive line, or reads a documented state file)** · P3: 005 → G2 · P4: 006 → G3 (re-estimate, critical path) · **EXT: wait for the fold merge** · B1 (A, parallel): 007 ∥ 010 ∥ 021 · B2: 008 ∥ 011 ∥ 012 ∥ 013 · B3: 009 ∥ 014 ∥ 015 ∥ 017 ∥ 018 ∥ 019 ∥ 020 ∥ 022 · B4: 016 ∥ 023 · B5: 024 · R1: 025 → G4 · R2: 026. Items 012-020 share one plugin source tree: merge them one at a time and keep one module per item, to avoid register-file conflicts.

**Spike (b) blocker.** 028 needs the keep-alive code on the unmerged fold branch (EXT). If EXT has not merged by G2, 028 moves to a build-wave item that may run after the merge, 005 records the open question and the fallback, and 014 builds to the fallback until the result arrives. A failed spike changes the design, not the scope (no cut, C1); a feature that cannot be built returns to the human.

**Acceptance Criteria.** Each item's ACs are its stories' ACs in `docs/product/ai-dlc-lens/stories.md`, by the Stories column (story to AC range: US-1 AC-1.1 to 1.5, US-2 AC-2.1 to 2.8, US-3 AC-3.1 to 3.10, US-4 AC-4.1 to 4.6, US-5 AC-5.1 to 5.6, US-6 AC-6.1 to 6.8, US-7 AC-7.1 to 7.11, US-8 AC-8.1 to 8.8, US-9 AC-9.1 to 9.7, US-10 AC-10.1 to 10.6, US-11 AC-11.1 to 11.9, US-12 AC-12.1 to 12.11, US-13 AC-13.1 to 13.8, US-14 AC-14.1 to 14.11, US-15 AC-15.1 to 15.6, US-16 AC-16.1 to 16.3, US-17 AC-17.1 to 17.6, US-18 AC-18.1 to 18.3, US-19 AC-19.1 to 19.4, US-20 AC-20.1, US-21 AC-21.1 to 21.4). Items without stories:
- 003: each open question has a cited answer. 004: stories carry numbered ACs and G1 is approved. 005: spec frozen, lens plugin location decided, each spike result cited or listed as an open question with its fallback, G2 approved. 006: tasks cover 007-029, no cut line, a re-estimate of the whole plan with the critical path marked, G3 approved. 025: zero Blockers on both axes. 026: go / no-go recorded.
- 027, 029: a written result in the run folder (what draws, what does not, the fallback), checked by the human in VS Code 2.1.299 or later; the scratch mod is deleted and touches none of the files the fold merge blocks. 028: a written result (works / does not, mechanism, fallback), recorded in the run folder.

---

## FEAT-20261020-ai-dlc-lens, scope v2 — tier 1 breakdown (roots 16-20) and roots 21-28

Source: `docs/product/active/work-breakdown-tier-1-sprint-1.md` (product-manager, 2026-10-24), plan `docs/handoffs/FEAT-20261020-ai-dlc-lens/00c-approved-plan-2026-10-24.md`, brief `docs/product/active/brief-tier-1-sprint-1.md`. Per-feature briefs and tags: `docs/product/active/<epic>/sprint-1/<feature>/tasks.md` (tier 1) and `docs/product/backlog/<epic>/<feature>/item.md` (roots 21-28). ITEM-030 to ITEM-066 share Added 2026-10-24, Status Backlog, Milestone **Unplanned** (decided by the product-owner), Lifecycle AAW, and the run's override chain (00c): system-engineer ↔ agent-manager, sqa-engineer, code-reviewer ×2, documentation-writer ↔ brutal-critique. Epics: `session-continuity-and-cache-visibility` (SC), `multi-agent-workflow-foundations` (MW), `ai-dlc-lens` (LENS). Tags are module / submodule / feature. ACs: the plan's *Tier 1 requirements* bullets by root, mapped in section 5 of the breakdown; the stories carry the final ids. Triage: RA ready-for-agent, RA* ready-for-agent once its needs-info blockers settle, NI needs-info (design at G2 or an open question). Every build item starts after G3; "G2" in Blocked by means a design decision frozen at G2. No Size column: sizes are set in the G3 task plan. Sprint 1 = 2026-10-20 to 2026-11-03 (extended 2026-10-25); roots 16-17 and 19 are in sprint 1, root 20 joined it on 2026-10-25 (builds beside root 22, merges after it), roots 21-28 are backlog-only except root 22 (ITEM-069 to 074).

| ID | Epic | Root.task | Item | Type | Pri | Triage | Blocked by | Tags |
|---|---|---|---|---|---|---|---|---|
| 030 | SC | 16.1 | Failing tests per branch first, then "title number wins" numbering | Bug | P1 | RA | G3 | ai-dlc / auto-handoff / handing-off |
| 031 | SC | 16.2 | `ATTRIBUTION.md` and `auto-handoff.schema.json` text | Bug | P1 | RA | 030 | ai-dlc / auto-handoff / handing-off |
| 032 | SC | 17.1 | Per-TTL cache state, main loop | Bug | P1 | RA | G3 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 033 | SC | 17.2 | Status line shows per-track state and a reason, never a bare `off`; regression test | Bug | P1 | RA | 032 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 034 | SC | 17.3 | Subagent writes feed per-TTL state; 5m arms from them; subagent pings (a fallback is a human decision, G1 Q34, default: the AC stands; if the G2 spike proves it impossible, it returns to the human) | Feature | P1 | NI | 032 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 035 | SC | 17.4 | 1h ping counter advances per ping (stuck at 0/9) | Bug | P1 | NI | 14.1.17 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 036 | SC | 17.5 | User explanation of cache semantics (docs, documentation-writer) | Feature | P2 | RA* | 033, 034 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 037 | MW | 18.1 | Optional taxonomy declaration, schema, `validate` | Feature | P1 | NI | G2 | ai-dlc / multi-agent-workflow / workflow-design |
| 038 | MW | 18.2 | `module`, `submodule`, `feature`, `integrations[]` keys; reject undeclared ids | Feature | P1 | NI | 037 | ai-dlc / multi-agent-workflow / handoff |
| 039 | MW | 18.3 | Run discovery at any depth; unique run ids | Feature | P1 | NI | G2 | ai-dlc / multi-agent-workflow / handoff; integration-2 |
| 040 | MW | 18.4 | `pickRun` filter by module | Feature | P2 | RA* | 038, 039 | ai-dlc / auto-handoff / handing-off |
| 041 | MW | 18.5 | Machine-readable session column in the Stages table | Feature | P1 | NI | 039, G2 | ai-dlc / multi-agent-workflow / handoff; integration-2 |
| 042 | MW | 18.6 | task-triage and product-planning rows carry the tags; missing = needs-info | Feature | P2 | RA* | 038 | ai-dlc / multi-agent-workflow / workflow-design |
| 043 | MW | 18.7 | Moved folders leave `merged-from-<old>.md` | Feature | P2 | RA* | 039 | ai-dlc / multi-agent-workflow / handoff |
| 044 | MW | 18.8 | This repository's taxonomy as the first declaration; tag current run-state versions, backlog items, tree files | Feature | P1 | NI | 037, 038 | ai-dlc / multi-agent-workflow / workflow-design |
| 044.a | MW | 18.8a | Split of 044: this repository's taxonomy declaration; tag the current run-state versions, backlog items and tier 1 product files (product data, written by product-manager) | Feature | P1 | NI | 037, 038 | ai-dlc / multi-agent-workflow / workflow-design |
| 044.b | MW | 18.8b | Split of 044: CI step in `.github/workflows/validate.yml` running `node .ai-dlc/workflow.mjs validate --artefacts` (code, agent-manager, AAWP) | Feature | P1 | NI | 038, 039 | ai-dlc / multi-agent-workflow / workflow-design |
| 065 | MW | 18.9 | Link fields between run, backlog item, task and session ids | Feature | P2 | NI | 038, 041 | ai-dlc / multi-agent-workflow / handoff; integration-2 |
| 066 | MW | 18.10 | Prioritised backlog items create run states in priority order | Feature | P2 | NI | 065, 042 | ai-dlc / multi-agent-workflow / handoff |
| 045 | MW | 19.1 | Prefactor: relax validator guards and schema for PO/SA-first AAW; no software-engineer | Feature | P1 | NI | G2 | ai-dlc / multi-agent-workflow / workflow-design |
| 046 | MW | 19.2 | AAW variant (a) harness: PO ↔ AM ↔ DW + BC | Feature | P1 | NI | 045 | ai-dlc / multi-agent-workflow / workflow-design |
| 047 | MW | 19.3 | AAW variant (b) plugin/mod: PO ↔ SA ↔ SE ↔ AM ↔ SQA ↔ CR, DW + BC | Feature | P1 | NI | 045 | ai-dlc / multi-agent-workflow / workflow-design |
| 048 | MW | 19.4 | Variant selection from the change set; orchestrator hard rule; routing; tests per signal | Feature | P1 | NI | 046, 047 | ai-dlc / multi-agent-workflow / workflow-design |
| 049 | MW | 19.5 | Records per mode: BC reviews handoffs, sender verifies in team mode; N.1 slots | Feature | P1 | NI | 047, 050 | ai-dlc / multi-agent-workflow / handoff |
| 050 | MW | 19.6 | Per-handoff BC review loop: own limits and env variables in `rounds --json` | Feature | P1 | NI | 045 | ai-dlc / multi-agent-workflow / loop-design |
| 051 | MW | 19.7 | Subagent fallback, Copilot, consumer upgrade path | Feature | P1 | NI | 048, 049 | ai-dlc / multi-agent-workflow / workflow-design |
| 052 | LENS | 20.1 | Spike: fence replacement inside a reply, or render beneath it (human checks in VS Code) | Feature | P2 | RA | G1 | ai-dlc-lens / diagramming / diagramming-mods |
| 053.a | LENS | 20.2a | Build spike: pick the PNG rasteriser (resvg WASM preferred), measure bundle sizes (Mermaid and ELK only; the MathJax size is deferred with 054), font; the PlantUML security profile (053.a2) is deferred with 055 to sprint 2 (human, 2026-10-25); 053 depends on it | Feature | P2 | RA | 052 | ai-dlc-lens / diagramming / diagramming-mods |
| 053 | LENS | 20.2 | Mermaid fences render offline | Feature | P2 | NI | 052, G2 | ai-dlc-lens / diagramming / diagramming-mods |
| 054 | LENS | 20.3 | LaTeX math via bundled MathJax. **Backlog, scheduled sprint 2** (moved out of sprint 1 by the human, 2026-10-25) | Feature | P2 | NI | 053 | ai-dlc-lens / diagramming / diagramming-mods |
| 055 | LENS | 20.4 | PlantUML with a local Java + jar. **Backlog, scheduled sprint 2** (moved out of sprint 1 by the human, 2026-10-25); sprint 2 runs the 053.a2 security-profile check first | Feature | P2 | NI | 053, 053.a2 (sprint 2) | ai-dlc-lens / diagramming / diagramming-mods |
| 056 | LENS | 20.5 | `THIRD_PARTY_NOTICES.md` and `ATTRIBUTION.md` entries for 053 only (Mermaid layout, ELK.js, rasteriser, font, mermaid-inline; creates `hooks/ATTRIBUTION.md`); lens checks pass. Re-scoped 2026-10-25; the 054 and 055 notices are ITEM-075 | Feature | P2 | RA* | 053 | ai-dlc-lens / diagramming / diagramming-mods |
| 057 | MW | 21 | Agile skill and product tree; migrate this repository | Feature | P1 | NI | 18 (037, 038, 039) | ai-dlc / multi-agent-workflow / agile-product-tree |
| 058 | LENS | 22 | Umbrella, split 2026-10-25 into 069-074: Cache Lab and Context Lab; takes the lens cost fixes from root 17 | Feature | P2 | NI | 17 (032, 033, 034) | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |
| 059 | MW | 23 | New default AI-DLC phases, auto/manual switch, one run state per wave | Feature | P1 | NI | 18, 19, 21 | ai-dlc / multi-agent-workflow / default-phases |
| 060 | LENS | 24 | Lens workflow grouping by epic, sprint, feature, module; per-wave accordions; session charts | Feature | P1 | NI | 16, 18, 21, 23 | ai-dlc-lens / run-views / workflow-grouping; integration-2 |
| 061 | LENS | 25 | Lens: auto mode shown as an anomaly | Feature | P2 | NI | 23 | ai-dlc-lens / run-views / auto-mode-anomaly; integration-2 |
| 062 | LENS | 26 | Lens review submodule: changed-files panel, approve / reject / skip, line comments | Feature | P2 | NI | 23, 14.1.7 | ai-dlc-lens / review / changed-files-panel; integration-2 |
| 063 | LENS | 27 | VS Code runs launcher (button, popup, side panel) or the approved fallback | Feature | P2 | NI | 24, 14.1.7 | ai-dlc-lens / runs-launcher / vscode-launcher; integration-2 |
| 064 | SC | 28 | Integration fixes from the 14.1.5 audit (2 bugs, 8 risks, 6 enhancements) and the 14.1.4 VS Code status table; hook-side tier 2 after 16 and 17; each lens-side finding with the lens root that edits the same file (22 tier 2, 24 tier 3, 27 tier 4); detail in `docs/product/backlog/session-continuity-and-cache-visibility/integration-fixes/item.md` | Feature | P2 | NI | 14.1.5, G1, 16, 17; lens-side also 22, 24, 27 | ai-dlc / cache-keepalive / integration-fixes; integration-1, integration-2 |
| 067 | LENS | 33 | Lens flowchart in team mode: teammate-to-teammate edges for SendMessage and for handoff / hand-back records; detail in `docs/product/backlog/ai-dlc-lens/team-mode-flowchart/item.md`; tier 3 after 24, deep dive done (33.1.2); human questions Q33a-e at G1 for tier 3 | Feature | P2 | NI | 19 (049), 18 (041), 24 (060), 067.a, Q33a-e | ai-dlc-lens / agent-workflows / team-mode-flowchart; integration-2 |
| 067.a | LENS | 33.0 | Build-time spike: live `session.send` between in-process teammates and the `tool.call` SendMessage payload; written ruling on R1 and fallback | Feature | P2 | RA | — | ai-dlc-lens / agent-workflows / team-mode-flowchart |
| 034.c | SC | 17.3c | Build-time live [MV] check by sqa-engineer, human watching: do subagent `turn.step` usage and the SubagentStop transcript carry the 5m/1h cache split? First task of 034, blocks its subagent part. Fail: D2a (`subagents: split unknown`); no subagent usage at all: back to the human | Feature | P1 | RA | 032 | ai-dlc / cache-keepalive / statusline |
| 034.a | SC | 17.3a | Build-time spike: `$.session.send` to an idle subagent or teammate (cost, side effects, cache hit); pass thresholds to the human at G2 (OQ3) | Feature | P1 | RA | 034 | ai-dlc / cache-keepalive / statusline |
| 034.b | SC | 17.3b | CONDITIONAL on 034.a: subagent keep-alive ping via messaging, opt-in `pingSubagents` default OFF (AC-17.3.2, 17.3.5, 17.3.6); dropped, ACs back to the human, if 034.a fails | Feature | P1 | NI | 034.a | ai-dlc / cache-keepalive / statusline |
| 068 | SC | 17.6 | US-17.6, AC-17.6.1 to 17.6.41: status line shows both tracks (5m, 1h) always, each with `keep warm Xh (source)` and `ping k/m`, even when off; band (Terminal, Desktop) and Pane (VS Code) with a master button and a button per track (D10, D11), session-only, no settings writes; status lines hidden when nothing is allowed (the band or Pane still shows rows and buttons). Spec rev 4 delta to E4/E5. D13 status-line summary (`summaryOf`, surface rule, `statusText` setting, `AI_DLC_KEEPALIVE_STATUS_TEXT`, LLD rev 11). Size 5 (was 4). Sprint 1 extension, 2026-10-25 | Feature | P2 | NI | 17.2.4 (rev 5 gap fix), 034, combined G1+G2+G3 | ai-dlc / cache-keepalive / statusline; integration-1 |
| 069 | LENS | 22.a | Split of 058: transcript reader and pricing (prices from `.ai-dlc/model-metadata.json`, "no price" when unpriced). Size 3 | Feature | P2 | NI | combined G1+G2+G3 (no 034 edge since 2026-10-25); 22 merges before root 20 | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |
| 070 | LENS | 22.b | Split of 058: Cache Lab accordion, Saved by cache / Lost to busts / NET and cards Cache Hit %, Tokens Saved, Bust events, Median baseline. Size 3 | Feature | P2 | NI | 069 | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |
| 071 | LENS | 22.c | Split of 058: miss attribution (TTL lapse / Prefix change / Unknown) and TTL Mix (5m / 1h / unknown). Size 2 | Feature | P2 | NI | 070 | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |
| 072 | LENS | 22.d | Split of 058: Invalidation Gallery as a sub-accordion in Cache Lab (bust events only, cap 50 plus total and truncated; turn link per research 17.1.12). Size 2 | Feature | P2 | NI | 070 | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |
| 073 | LENS | 22.e | Split of 058: rename the Usage accordion to Context Lab. Size 1. Added 2026-10-25 | Feature | P2 | NI | 069 (soft, same file); combined G1+G2+G3 | ai-dlc-lens / cache-context-lab / context-lab; integration-2 |
| 074 | LENS | 22.f | Split of 058: Keep Alive sub-accordion inside Cache Lab, last child (AC-22.7.1); the header line `keepaliveRow` stays. Size 2. Added 2026-10-25 | Feature | P2 | NI | 070; 032, 033 (merged); combined G1+G2+G3 | ai-dlc-lens / cache-context-lab / keepalive-accordion; integration-2 |
| 075 | LENS | 20.6 | Sprint 2 follow-up of 056: `THIRD_PARTY_NOTICES.md` and `ATTRIBUTION.md` entries for 054 (MathJax, claude-latex, LaTeX Inline) and 055 (PlantUML, any reused idea); lens `validate` and `test` pass. A new item (not part of 054 or 055) so each of the three merges on its own; ACs AC-20.7.1 to 20.7.3 for those upstreams. Size S. Added 2026-10-25 | Feature | P2 | NI | 054, 055 (both sprint 2); 056 | ai-dlc-lens / diagramming / diagramming-mods |
| 076 | SC | 17.7 | Keep-alive chain state: an automatically handed-off chain is one combined session; switches and `--session` overrides keyed by chain id, kept across the handoff; keep-alive off at handoff means on by default in the handed-off session, switches carry over, both configurable (`handoff.onWhenOff`, `handoff.carryOver`); never changes the cache prefix; a session started by hand starts clean. Size 2 (se-fix). Human decision 2n(3), 2026-10-25. KA lane after 068 | Feature | P2 | NI | 068 (switch store); combined G1+G2+G3 or its own stop | ai-dlc / cache-keepalive / statusline; integration-1 |
| 077 | LENS | 22.g | Cache Lab chain window: the `session` window and the "This session" preset resolve to every session id of the automatic-handoff chain (reuses 076's shared `chainIdOf` / `chainSessions` in `chain.ts`). Size 1 (se-fix). Added 2026-10-25 | Feature | P2 | NI | 070; 076 (cross-lane); combined G1+G2+G3 or its own stop | ai-dlc-lens / cache-context-lab / cache-lab; integration-2 |

**Waves.** After G1: 052. Wave 2 design: G2, then G3 (task plan). Build, tier 1, after G3: 3.1 {030, 032, 035 (once 14.1.17 lands), 037, 039, 045, 053} · 3.2 {031, 033, 034, 038, 041, 043, 046, 047, 050, 054, 055} · 3.3 {036, 040, 042, 044, 048, 049, 065} · 3.4 {051, 056, 066}. Tiers 2-4 start per item when their blockers pass review: tier 2 {057, 058, 059, 064 hook-side}, tier 3 {060, 061, 062}, tier 4 {063, 064 lens-side}.

Waves give start order; merges follow the group order. **Merge groups** (one item at a time): KA hooks/auto-handoff + hooks/keepalive; WF workflow.mjs/schema/template; HS handoff skill; RUN run.ts/lens.ts parsing; LENS lens register.tsx (order: 20, 22, 24, 25, 26, 27).

**Tier-order corrections to the plan:** 23 also after 21; 24 also after 23; 26 also after 14.1.7; 28 hook-side moves to tier 2.

**Out-of-scope check:** `docs/backlog/out-of-scope/` does not exist; no prior rejection matched. No P0 items.

**Sprint 1 extension (2026-10-25).** Human: ALL in this sprint, one combined G1+G2+G3 stop. End date moves from 2026-10-27 to **2026-11-03** (human-set; the earlier 2026-11-02 proposal is dropped). New items 068 (status-line delta, root 17) and 069 to 074 (split of 058; 073 and 074 added on the human's answer to keep the root 22 leftovers in this sprint). Decisions of 2026-10-25: root 20 (053.a to 056) joins the sprint, root 22 merges first and root 20 builds on it (one lens lane, revised by the human on 2026-10-25; no rebase, T20.R dropped); the 034 edge on 069 to 074 is dropped, so the LENS-22 lane starts right after the stop; the 034 edge stays on 068. Root 20 is no longer Carry (one LENS lane after root 22; only the 053.a spike runs now, in E0, as step 20.1.5). Sizes are placeholders until software-architect and system-engineer size them. Ordering, waves, critical path (22 placeholder sessions after the stop, about 5.5 days, latest safe stop about 2026-10-27 to 2026-10-28; 056, 055 and maybe 054 at risk of carrying) and human points: `docs/plans/tier-1-sprint-1.tasks.md` section 12. ITEM-036 (T17.5) also waits for 068. Wave E1 after the stop: KA lane 034.c, 034, 068, 036; one LENS lane 069, 070, 071, 072, 073, 074, then 053.b/c, 054, 055, 056 (053.a spike already in E0).

**Scope change 1 (2026-10-25): PlantUML to sprint 2.** Human: "move plant UML to the backlog and schedule it for the next sprint". ITEM-055 (T20.5) is out of sprint 1, in the backlog, scheduled for sprint 2. The 053.a2 PlantUML security-profile check of the spike is deferred with it.

**Scope change 2 (2026-10-25): LaTeX to sprint 2.** Human: "also latex to the next sprint". ITEM-054 (T20.4, MathJax) is treated like 055: out of sprint 1, in the backlog, scheduled for sprint 2. ITEM-056 for sprint 1 covers 053 only; the notices for 054 and 055 are the new sprint-2 item ITEM-075 (a separate item, depends on 054, 055 and 056). Root 20 in sprint 1 is now 053.a (E0, running), 053.b, 053.c and 056. Sprint-1 LENS lane: 069 to 074, then 053.b, 053.c, 056. With the agreed sizes (069=3, 070=3, 071=2, 072=2, 073=1, 074=2; 053.b=3, 053.c=2, 056=1 placeholders) that is 19 sessions after the stop, about 4.75 days; latest safe stop with a buffer 2026-10-28. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.6. Sprint 2 intake: 054, 055 (with 053.a2 first), 075, plus the carry list.

**Scope change 3 (2026-10-25): combined-session carry-over.** Human decision 2n(3) and the combined-session principle (an automatically handed-off chain is one session): new ITEM-076 (KA lane, after 068, M 2) and ITEM-077 (LENS lane, after 074, S 1, needs 070 and 076). LENS lane is now 20 sessions after S1, about 5.0 days; latest safe S1 stays 2026-10-28 (about 0.75 day spare); KA latest safe H1 2026-10-30. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.7.

**Scope change 4 (2026-10-25): ITEM-068 grows to 5 sessions** (D13 status-line summary, `statusText` setting; LLD rev 11). KA lane about 3.0 days after H1; latest safe H1 2026-10-29 (was 2026-10-30); latest safe S1 stays 2026-10-28. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.8.

**Scope change 5 (2026-10-25): H1 sitting moves to 2026-10-29** (human, after gate critique round 2). It is the latest safe H1 (no buffer on the KA lane); the S1 stop stays by 2026-10-28; the 034.c follow-ups change no sizes. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.8.
