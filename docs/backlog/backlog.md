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
