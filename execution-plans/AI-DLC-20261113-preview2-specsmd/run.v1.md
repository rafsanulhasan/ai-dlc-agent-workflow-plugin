---
run: AI-DLC-20261113-preview2-specsmd
lifecycle: AI-DLC (planning segments: PDLC → ASDLC → STBLC, in specsmd terms intent → unit design → bolt design)
status: active
branch: plan/preview2
worktree: .worktrees/preview2-planning
session: 4091c818-fe58-4fbe-abec-ffd8f9ea53af
version: v1
commit: 47a3480
last-record: 1.1.6-product-manager-to-orchestrator.handback.md
mode: sequential subagent chain (Mode 3); critique stages DW ↔ BC
---

# Run state — preview2 planning: specsmd memory bank, bolts, events

## Request
"Integrate specsmd into my plugin. Redefine our handoff skill with the memory bank (of specsmd) idea instead of our docs structure. All the docs go to memory bank; instead of handoff, an execution-plans folder for the bolts' execution plans, handoffs/handbacks and the event-driven things Copilot stated. Suggest a name. Start the planning with specsmd steps like unit design and bolt design. Target repos get `memory-bank/product` (the product) and `memory-bank/project` (DevOps flows, agent harness engineering, other non-product work)."

## Clarified intent
Plan `1.0.0-preview2`: adapt specsmd natively (intents → units → bolts), move all lifecycle docs to `memory-bank/product|project`, replace `docs/handoffs/` with `execution-plans/` holding bolt execution plans, hand-offs/hand-backs and typed events. Planning only in this run; building the units are later AAWP runs.

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
| 1.1.7 | intent brief (PDLC brief) | product-owner | in-progress | 1.1.7 | — | — |
| 1.1.8 | brand-name check + `.handoff/config.md` | research-assistant | in-progress | 1.1.8 | — | — |
| — | requirements + ACs (PDLC stories) | requirement-analyst | pending | | | |
| — | backlog: preview2 milestone, move to memory-bank/project | product-manager → documentation-writer | pending | | | |
| — | write + critique intent docs | documentation-writer ↔ brutal-critique | pending | | | |
| — | accept (G1) | product-owner → human | pending | | | |
| — | unit design: architecture + LLD + spec (G2) | software-architect ↔ system-engineer | pending | | | |
| — | bolt design (G3) | product-manager + software-architect | pending | | | |
| 2 | run-start commit | devops-engineer | in-progress | 2 | — | — |

## Gates and loops
G1, G2, G3: approver human. Loop limits (`rounds --json`, 2026-11-13): every loop 2 rounds / 1 failure (source: loop); gate-critique 2 / 1 (default); clarify 2 / 1.
herdr: not detected (HERDR_ENV unset).

## Open clarifications
none

## Next action
Wait for 1.1.7 (product-owner intent brief) and 1.1.8 (brand check); verify; then requirement-analyst (FRs → ACs), then product-manager backlog, then documentation-writer writes the intent into memory-bank with brutal-critique, then G1.
