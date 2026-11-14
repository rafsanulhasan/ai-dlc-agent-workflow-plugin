---
run: AI-DLC-20261113-preview2-specsmd
lifecycle: AI-DLC (planning segments: PDLC → ASDLC → STBLC, in specsmd terms intent → unit design → bolt design)
status: active
branch: plan/preview2
worktree: .worktrees/preview2-planning
session: c4ce9349-88d8-4a9c-9a7e-c87b7eb1e667 (auto-handoff from 4091c818, 2026-11-14)
version: v1.1 (direction change after G1: plugin rename D15–D17, two product units D14/D18)
commit: c4b5c22
last-record: 7-orchestrator-to-human.handoff.md
mode: sequential subagent chain (Mode 3); critique stages DW ↔ BC
---

# Run state — preview2 planning: specsmd memory bank, bolts, events

## Request
"Integrate specsmd into my plugin. Redefine our handoff skill with the memory bank (of specsmd) idea instead of our docs structure. All the docs go to memory bank; instead of handoff, an execution-plans folder for the bolts' execution plans, handoffs/handbacks and the event-driven things Copilot stated. Suggest a name. Start the planning with specsmd steps like unit design and bolt design. Target repos get `memory-bank/product` (the product) and `memory-bank/project` (DevOps flows, agent harness engineering, other non-product work)."

## Clarified intent
**Planning only (human, 2026-11-13: "make plan only, don't implement anything yet").** No plugin, hook, skill, agent, schema, tooling or test changes in this run; only planning artifacts (intent, unit briefs, bolt plans, backlog entries) and run records. Plan `1.0.0-preview2`: adapt specsmd natively (intents → units → bolts), move all lifecycle docs to `memory-bank/product|project`, replace `docs/handoffs/` with `execution-plans/` holding bolt execution plans, hand-offs/hand-backs and typed events. Planning only in this run; building the units are later AAWP runs.

## Decisions (human, 2026-11-13) — `decisions-2026-11-13.md`
D1 adapt specsmd natively, MIT attribution · D2 stage agents own content, documentation-writer sole author of memory-bank files, brutal-critique gates · D3 scope bank + bolts + typed events (files + schema), no deterministic runtime · D4 keep `ai-dlc` id, brand name later after a clash check · D5 base `feat/ai-dlc-lens` 47a3480 · D6 plan with specsmd steps · D7 preview1 ships first; this is preview2 (breaking, with migration) · D8 dogfood: this run's artifacts go to `memory-bank/` and `execution-plans/` now · D9 old `docs/` paths read for one release · D10 backlog → `memory-bank/project/`.

## Artifact paths (this run, dogfooded — D8)
- Intent: `memory-bank/product/intents/001-preview2-specsmd/requirements.md` (+ `inception-log.md`)
- Units: `memory-bank/product/intents/001-preview2-specsmd/units.md`, `units/{UUU}-{unit}/unit-brief.md`
- Bolts: `memory-bank/product/bolts/{BBB}-{unit}/bolt.md`
- Backlog: `memory-bank/project/backlog.md` (moved from `docs/backlog/backlog.md` at G1)
- Run records: this folder.
Known gap (corrected 2026-11-14, 6.2): auto-handoff, ai-dlc-lens and run discovery take their folder from `artifacts.handoffs` (fallback `docs/handoffs/`). Before D42 they read `docs/handoffs/`, so this run had to be pointed at by hand; on `plan/preview2` after 6.2 they read `execution-plans/`, and the old `docs/handoffs/` runs are the ones not found. The main checkout (`feat/ai-dlc-lens`) still has `docs/handoffs/`.

## Work breakdown (product-manager, `1.1.6-work-breakdown.md`)
Units 1–13: 1 Foundations (P0) · 2 bank in tooling · 3 authorship + docs-status · 4 intents/units/bolts in lifecycles+agents · 5 execution-plans + typed events + handoff rewrite · 6 hooks + lens paths · 7 path sweep · 8 migration · 9 attribution · 10 brand research · 11 dogfood repo · 12 integration · 13 docs + release.

## Stages
| step | stage | agent | status | handoff | hand-back | verification |
|---|---|---|---|---|---|---|
| 1.1.1–1.1.5 | research (Copilot chat, specsmd, repo) | research-assistant | done | 1.1.1…1.1.5 | 1.1.1.l1.2, 1.1.2, 1.1.3, 1.1.5 | passed (1.1.1, 1.1.1.l1.1 failed: sign-in) |
| 1.1.4 | worktree | devops-engineer | done | 1.1.4 | 1.1.4 | passed |
| 1.1.6 | work breakdown | product-manager | done | 1.1.6 | 1.1.6 | passed |
| 1.1.7 | intent brief (PDLC brief) | product-owner | done | 1.1.7 | 1.1.7 | passed |
| 1.1.8 | brand check + .handoff/config.md | research-assistant | done | 1.1.8 | 1.1.8 | passed |
| 1.1.9 | ACs (PDLC stories) | requirement-analyst | done | 1.1.9 | 1.1.9 | passed |
| 1.1.10 | clarify (C-1,2,3,6,10,11,12) | product-owner | done | 1.1.10 | 1.1.10 | passed |
| 1.1.11 | backlog content | product-manager | done | 1.1.11 | 1.1.11 | passed |
| 1.5.1 | write intent into memory bank | documentation-writer | done | 1.5.1 | 1.5.1 | passed |
| 1.5.2 | gate critique round 1 | brutal-critique | done (PASS, 3 Major) | 1.5.2 | 1.5.2 | passed |
| 1.5.l1.1 | ACs + backlog + fixes | documentation-writer | done | 1.5.l1.1 | 1.5.l1.1 | passed |
| 1.5.l1.2 | gate critique round 2 (limit) | brutal-critique | done (PASS, 2 Major) | 1.5.l1.2 | 1.5.l1.2 | passed |
| 1.1.12 | accept (PDLC accept) | product-owner | done (Accepted, FR-5 condition) | 1.1.12 | 1.1.12 | passed |
| 1.5.l1.3 | final G1 touch-up (no 3rd critique) | documentation-writer | done | 1.5.l1.3 | 1.5.l1.3 | passed |
| 2 | run-start commit | devops-engineer | done (18b160c, signed) | 2 | 2 | passed |
| 3 | G1 gate | human | done — APPROVED 2026-11-13 | 3 | (human, in chat) | approved |
| 1.1.13–1.1.18 | FR-17 rename amendment (RA, PO, research) | requirement-analyst, product-owner, research-assistant | done | 1.1.13–1.1.18 | same | passed |
| 1.5.l2.x | amendment write-up and critique (2 rounds PASS) | documentation-writer ↔ brutal-critique | done | 1.5.l2.1–1.5.l2.6 | same | passed |
| 4 | G1 amendment gate | human | done — APPROVED 2026-11-13 (D26) | 4 | — | approved; commit 8fb7f7e |
| 1.1.14, 1.1.19, 1.1.19.1, 1.1.20 | unit design, LLD, refine | software-architect, system-engineer | done | same | same | passed |
| 1.1.21 (rev 1–3), 1.1.22 | frozen spec; G2 fix decisions | requirement-analyst, software-architect | done | same | 1.1.21, 1.1.21.1, 1.1.21.2, 1.1.22 | passed |
| 1.5.l3.x | G2 documents, name sweeps (D30–D37), critique REVISE → PASS | documentation-writer ↔ brutal-critique | done | 1.5.l3.1–1.5.l3.8 | same | passed |
| 5 | G2 gate | human | done — APPROVED 2026-11-14 (D38–D41) | 5 | — | approved; commit c4b5c22 |
| 1.1.23 | STBLC split + bolt design (31 stories, 13 bolts) | software-architect | done | 1.1.23 | 1.1.23 | passed |
| 1.1.24 | STBLC split-design | system-engineer | done — two reports (original dispatch S-1…S-8; re-dispatch F-1…F-11, R-12…R-14); both say no lib/ split; conflicts listed in 1.1.24.1 for the architect to reconcile | 1.1.24 | 1.1.24 (original, full), 1.1.24.1 (re-dispatch, condensed only; its scratch copy was overwritten) | passed |
| 1.1.25 | product-owner questions (R-3, R-8, O-4) | product-owner | done (all three accepted; R8 amended: AC-17.14 owned whole by engine; follow-ups.md moves in ITEM-121; O-4 yes) | 1.1.25 | 1.1.25, 1.1.25.1 (duplicate re-dispatch, agrees) | passed |
| 1.1.26 | estimate | software-engineer | done (~44 ideal days elapsed, range 34–63; readings A/B differ <0.2d) | 1.1.26 | 1.1.26 | passed |
| 1.1.27 | order (G3) | product-owner | done (W1–W6 stand; 007/008 start after 004 merges; 012 split if architect agrees; Windows CI AC in 009; 2 clarify-human) | 1.1.27 | 1.1.27 | passed |
| 1.1.28 | split-design reconciliation (Refine) | software-architect | done (C-1..C-7 mostly reading A; F-11 write-documentation/templates/bank/; 012 split sound; r1 item list; D42: 007/008 testable here) | 1.1.28 | 1.1.28 | passed |
| 1.1.29 | 012 split final + 012a wave | product-owner | done (14 bolts; 012a in W3 non-blocking, W5 fallback; new clarify-human) | 1.1.29 | 1.1.29 | passed |
| 1.1.30 | spec revision delta r1 content | requirement-analyst | done with clarify C1–C4 (content in .scratch/preview2-g3/1.1.30-r1-delta.md, 2 [OPEN] marks) | 1.1.30 | 1.1.30 | passed |
| 1.1.30.1 | clarify C1, C4 | product-owner | done (C1 (a): migration bolt = 014; C4 no change) | 1.1.30.1 | 1.1.30.1 | passed |
| 1.1.30.2 | clarify C2, C3 | software-architect | done (C2 convention only; C3 ids 012-engine-migrate-plan, 014-engine-migrate-settings) | 1.1.30.2 | 1.1.30.2 | passed |
| 1.5.l4.1 | G3 documents (r1 delta, 31 stories, 14 bolts, task plan, backlog, unit briefs, README) | documentation-writer | done | 1.5.l4.1 | 1.5.l4.1 | passed |
| 1.5.l4.2.1–.3 | G3 gate critique round 1 (delta; stories+bolts; plan+backlog+briefs) | brutal-critique ×3 | done — .1 REVISE (1B 4M), .2 PASS (4M), .3 REVISE (1B 5M); failure 1/1 used | 1.5.l4.2 | 1.5.l4.2.1, .2, .3 | passed |
| 1.5.l4.3 | G3 fix round (all findings) | documentation-writer | done (all fixed except .3 m1, m3 left for PM; .2 m5 not needed) | 1.5.l4.3 | 1.5.l4.3 | passed |
| 1.5.l4.4.1–.3 | G3 re-critique (last round) | brutal-critique ×3 | done — PASS ×3, 0 B / 0 M; Minors open (in gate record) | 1.5.l4.4 | 1.5.l4.4.1, .2, .3 | passed |
| 7 | G3 gate | human | pending — awaiting decision | 7 | — | — |
| 1.1.31 | backlog + task-plan content | product-manager | done (14 bolts; ~39.5 ideal days elapsed, 31–58; 44 if 012a falls back) | 1.1.31 | 1.1.31 | passed |
| — | spec delta r1; stories, bolts, plan; critique; G3 | requirement-analyst; documentation-writer ↔ brutal-critique; human | pending | | | |

## Joined requests
### Feature 6 — Q1 answered "now" (D42, 2026-11-14)
Request: point this repository's `artifacts.handoffs` at `execution-plans/` now. Lifecycle AAWH (change set = `.ai-dlc/workflow.json`, docs, in harnessPaths). Mode: sequential subagent chain. Branch `plan/preview2`.
| step | stage | agent | status | handoff | hand-back | verification |
|---|---|---|---|---|---|---|
| 6.1.1 | intent | product-owner | done (handoffs key only; old folders stay; 2 clarify-human questions, defaults applied) | 6.1.1 | 6.1.1 | passed |
| 6.2 | change | agent-manager | done (workflow.json:715, AGENTS.md:316,342 — docs; validate, rounds, sync --check quoted) | 6.2 | 6.2 | passed |
| 6.5 | critique | brutal-critique | done — PASS round 1 (0 Blocker, 0 Major; Minors 1–4 open, optional round 2 offered to the human) | 6.5 | 6.5 | passed |
Feature 6 status: done (2026-11-14). Uncommitted; commit with the G3 records (devops-engineer).

## Direction change (v1.1, 2026-11-13)
After G1 the human (a) named two product units, ai-dlc-engine and ai-dlc-lens, and (b) decided to rename the plugin to ai-dlc-engine and the marketplace (name TBC), keeping .ai-dlc/ and AI_DLC_*. G1 artifacts need an amendment (FR-17 rename; FR-13, FR-16, AC-13.2, AC-16.4, D4 references) → G1-amendment approval by the human. Unit design proceeds in parallel on the two units.

## Gates and loops
G1, G2, G3: approver human. Loop limits (`rounds --json`, 2026-11-13): every loop 2 rounds / 1 failure (source: loop); gate-critique 2 / 1 (default); clarify 2 / 1.
herdr: not detected (HERDR_ENV unset).

## Open clarifications
- 1.1.30 round 1: closed 2026-11-14 (C1–C4 answered, 1.1.30.1, 1.1.30.2).
- Spec housekeeping found by requirement-analyst: spec:4/:11 still draft / G2 pending; §17 O-1, O-2, O-3, O-5 still open though D39, D41 decided them.

## Next action
Waiting for the human at G3 (record 7): approve; AC-16.6 and red-job blocking; bolt 001 session; 012 in W3; feature 6 follow-ups. On approval: record the decision (D44+), devops-engineer commits the G3 records, bank files and feature 6 on plan/preview2 (signed); then product-manager items (ITEM-111 status, ITEM-126 lifecycle). No bolt starts without an explicit go. Names: plugins engine, lens; marketplace forgeline (D30–D37). Planning only.
