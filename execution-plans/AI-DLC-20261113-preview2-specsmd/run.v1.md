---
run: AI-DLC-20261113-preview2-specsmd
lifecycle: AI-DLC (planning segments: PDLC → ASDLC → STBLC, in specsmd terms intent → unit design → bolt design)
status: active
branch: plan/preview2
worktree: .worktrees/preview2-planning
session: 4091c818-fe58-4fbe-abec-ffd8f9ea53af
version: v1
commit: 18b160c
last-record: 1.5.l1.3-documentation-writer-to-orchestrator.handback.md
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
Known gap: auto-handoff, ai-dlc-lens and run discovery read only `docs/handoffs/`; a new session must be pointed here by hand.

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
| — | unit design (G2) | software-architect ↔ system-engineer | pending | | | |
| — | bolt design (G3) | product-manager + software-architect | pending | | | |

## Gates and loops
G1, G2, G3: approver human. Loop limits (`rounds --json`, 2026-11-13): every loop 2 rounds / 1 failure (source: loop); gate-critique 2 / 1 (default); clarify 2 / 1.
herdr: not detected (HERDR_ENV unset).

## Open clarifications
none

## Next action
G1: human approves or rejects 3-orchestrator-to-human.handoff.md. Then commit (devops-engineer, after GPG) and start unit design (ASDLC → G2).
