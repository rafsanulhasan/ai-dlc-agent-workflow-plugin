---
run: RES-20261020-ai-dlc-mods
work-item: none
lifecycle: AI-DLC
step: 13
from: product-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-31
---

handoff 13-orchestrator-to-product-manager.handoff.md: passed — the record is present, its front matter and four instructions match the brief, and the two artifacts it names (12-research-assistant-to-orchestrator.handback.md, backlog.md) exist.

I added 14 items, ITEM-078 to ITEM-091, as one new section at the end of `docs/backlog/backlog.md`. The file went from 180 to 206 lines. I did not commit, plan a sprint or start work.

Each item carries the requirement as its source, a description, candidate mods, reuse and overlap, priority with a one-line reason, and an open question. All are Type Feature, Status Backlog, Milestone Unplanned, Added 2026-10-31, lifecycle AAWP, triage needs-info. ACs are not written: the requirement-analyst writes the stories and numbered ACs at G1, as for the other needs-info items. Priorities are provisional and need a product-owner decision.

| ID | Req | Title | Pri |
|---|---|---|---|
| 078 | R1 | Auto-handoff gaps: 5-hour/weekly trigger, seed names current `run.v<n>.md`, fresh-session tooling | P2 |
| 079 | R2 | Weekly-usage guard at 70%: stop and print the continue command (no account rotation) | P2 |
| 080 | R4+R14 | Model and effort policy per agent/stage/task (`effort:` frontmatter, `workflow.json` policy, Routing Plan, Copilot build) | P2 |
| 081 | R5 | Project-wide context/cache/waste bar and a definition of "context waste" | P3 |
| 082 | R6 | Review pane gaps: edit capture and revert | P3 |
| 083 | R7 | Stack-neutral quality gate (SQA CLI plus a Stop hook) | P2 |
| 084 | R8 | Blast radius (integrate the mod, Copilot `preToolUse` path) | P3 |
| 085 | R9 | Human-owned roles: `claimed-by` and assignees | P3 |
| 086 | R11 | Compact with keep-warm, plus `PreCompact`/`SessionStart` run-state snapshot and re-inject | P2 |
| 087 | R12 | Cross-worktree `runs` and the one-orchestrator-per-worktree recipe | P2 |
| 088 | R13 | Diagramming authoring skill in the core (UML, ER, C4, sequence) | P3 |
| 089 | R15 | Agile ceremonies: plan-sprint, retro, standup | P3 |
| 090 | R16 | Undo a workflow turn with git snapshots | P3 |
| 091 | R17 | Runaway-loop guard, `validate` warning for uncapped loops, rounds in the run state | P2 |

I reused these existing items instead of adding duplicates:
- **ITEM-062** covers the R6 review pane with approve, reject and skip. ITEM-082 adds only edit capture and revert.
- **ITEM-020** (per-agent ledger), **ITEM-058** and **ITEM-069 to ITEM-074** (Cache Lab) cover R5. ITEM-081 adds the project-wide bar and the waste definition.
- **ITEM-008** (`workflow.mjs runs`) and **ITEM-039** (run discovery) cover R12. ITEM-087 adds the cross-worktree scan and the recipe.
- **ITEM-052, 053, 054, 055, 056 and 075** cover R13 rendering. ITEM-088 is the authoring skill only.
- **ITEM-057** (agile skill) is the base for R15.
- **ITEM-065 and ITEM-041** are the nearest items for R9.
- **ITEM-030, 031 and 076** touch the same module as R1. ITEM-037 and 038 touch the workflow schema, which R4/R14 and R17 also edit.
- **ITEM-001 and ITEM-050** already cover loop limits, so ITEM-091 covers only the missing guard and warning.

R3 and R10 are built, so they have no item. `docs/backlog/out-of-scope/` has no records, so no rejected request was matched.

Open questions:
1. **Q-A (ITEM-078):** is the R1 5-hour-window trigger still wanted? If not, only the seed and tooling part stays.
2. **Q-B:** the plan counts 41 mods and section 3 of the step 11 report has 42 rows. I did not resolve it.
3. **Priorities (all items):** the product-owner needs to confirm them, especially ITEM-080 (cross-cutting across schema, routing and build), ITEM-083 (a blocking Stop hook is a trust decision) and ITEM-091.
4. **Per item:**
   - Whether the usage figures for ITEM-078 and ITEM-079 are readable from the hooks API (a spike for research-assistant).
   - Whether Copilot accepts an effort field (ITEM-080).
   - Whether `PreCompact` exists in the supported Claude Code version (ITEM-086).
   - Vendor or fork for ITEM-083 and ITEM-084, plus a licence check.
   - Whether ITEM-082's revert uses git snapshots (ITEM-090) or file diffs.
   - Who runs the ceremonies in ITEM-089.
   - Whether the human-claimed stage in ITEM-085 still gets a handoff record.
5. **Orchestrator, not mine to settle:** the research report says run.v4.md is stale and step 43 of the lens run has no live sign-off, so confirm that does not block closing RES-20261020-ai-dlc-mods.

The scratch file I appended from is `.scratch/pm-mods-backlog/section.md`; the scratch folder is gitignored.
