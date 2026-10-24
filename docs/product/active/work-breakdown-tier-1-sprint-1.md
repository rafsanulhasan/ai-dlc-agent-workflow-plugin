---
work-item: FEAT-20261020-ai-dlc-lens
kind: work-breakdown
scope: scope v2, tier 1 in detail (roots 16-20), tiers 2-4 (roots 21-28) at root level
author: product-manager
date: 2026-10-24
sprint: sprint-1 (2026-10-20 to 2026-10-27 inclusive)
status: draft, awaiting brutal-critique and product-owner acceptance
inputs: 00c-approved-plan-2026-10-24.md; deep dives 14.1.11-14.1.15 (docs/handoffs/FEAT-20261020-ai-dlc-lens/); brief-tier-1-sprint-1.md
backlog-ids: ITEM-030 to ITEM-066 (docs/backlog/backlog.md)
---

# Work breakdown: scope v2, tier 1 (roots 16-20) plus tier order of roots 21-28

Run: joins FEAT-20261020-ai-dlc-lens (run.v2.md, Wave 1) as new features. WI-n is the feature root (16 to 28), as the orchestrator fixed them; each item below is a task under its root. Per-feature briefs: `<epic>/sprint-1/<feature>/tasks.md`. Tiers 2-4: `docs/product/backlog/<epic>/<feature>/item.md`.

## 1. Epics, tree placement and tags

| Epic (folder) | Business goal | Roots |
|---|---|---|
| `session-continuity-and-cache-visibility` | Sessions hand off and caches behave the way the status line says | 16, 17, 28 |
| `multi-agent-workflow-foundations` | The team workflow is configurable, taxonomy-aware and agile | 18, 19, 21, 23 |
| `ai-dlc-lens` | See runs, cost, context and diagrams | 20, 22, 24, 25, 26, 27 |

Sprint 1 (active): roots 16-19, and 20 as stretch (product-owner's QS default). Roots 21-28 are backlog-only: sprint 1 ends in three days and they depend on tier 1.

Tag ids (item 044 makes them official; submodule ids for roots 21-27 are proposals in each `item.md`, declared when their root enters a sprint; they are the first declaration of this repository's taxonomy):
- module: `ai-dlc`, `ai-dlc-lens`, `integrations`
- submodule: `auto-handoff`, `cache-keepalive`, `multi-agent-workflow`, `diagramming`, `integration-1` (auto-handoff and keep-alive), `integration-2` (ai-dlc and the lens)
- feature ids are the plan *Area* terms: `handing-off`, `statusline`, `handoff`, `workflow-design`, `loop-design`, `diagramming-mods`

## 2. Tier 1 work items

Legend. Pri: P0-P3. Triage: `RA` ready-for-agent (its blockers are G1/G3 or other `RA` items), `RA*` ready-for-agent once its `NI` blockers settle, `RH` ready-for-human, `NI` needs-info (what is missing is in the feature's `tasks.md`). Blocked by: every build item starts after G3; "G2" means the item also waits for a design decision frozen at G2; "G1" means the item may start after G1. There is no Size column: sizes are set in the G3 task plan, and the wave is in section 3. Type F feature, B bug, T tech debt. All build items use the run's override chain (00c *Your decisions*): system-engineer ↔ agent-manager (Align), agent-manager implements and runs the checks, sqa-engineer, code-reviewer ×2 (conventions, intent), documentation-writer ↔ brutal-critique. Group: files that more than one item edits, merge one at a time.

| ITEM | Root.task | Item | T | Pri | Triage | Blocked by | Group | Module / submodule / feature |
|---|---|---|---|---|---|---|---|---|
| 030 | 16.1 | Failing tests per branch first, then "title number wins" numbering; replace the pinned tests | B | P1 | RA | G3 | KA | ai-dlc / auto-handoff / handing-off |
| 031 | 16.2 | `ATTRIBUTION.md` entry; `auto-handoff.schema.json` description (template + `.ai-dlc` copy) | B | P1 | RA | 030 | KA | ai-dlc / auto-handoff / handing-off |
| 032 | 17.1 | Per-TTL cache state for the main loop (replaces last-write-wins), with expiry time | B | P1 | RA | G3 | KA | ai-dlc / cache-keepalive / statusline; integrations: integration-1 |
| 033 | 17.2 | Status line shows each TTL track with a reason instead of a bare `off`; regression test "5m cache exists, line not off" | B | P1 | RA | 032 | KA | ai-dlc / cache-keepalive / statusline |
| 034 | 17.3 | Subagent cache writes feed the per-TTL state (labelled); 5m track arms from them; keep-alive pings subagent cache | F | P1 | NI | 032 | KA | ai-dlc / cache-keepalive / statusline; integrations: integration-1 |
| 035 | 17.4 | 1h ping counter advances by one per ping (reported as stuck at 0/9) | B | P1 | NI | 14.1.17 | KA | ai-dlc / cache-keepalive / statusline |
| 036 | 17.5 | User explanation of cache semantics (docs request to documentation-writer) | F | P2 | RA* | 033, 034 | — | ai-dlc / cache-keepalive / statusline |
| 037 | 18.1 | Optional taxonomy declaration + schema + `validate` (home decided at G2); no declaration = unchanged behaviour | F | P1 | NI | G2 | WF | ai-dlc / multi-agent-workflow / workflow-design |
| 038 | 18.2 | `module`, `submodule`, `feature`, `integrations[]` keys on run state, backlog, stories, tasks; `validate` rejects undeclared ids | F | P1 | NI | 037 | WF | ai-dlc / multi-agent-workflow / handoff |
| 039 | 18.3 | Run discovery at any depth; run ids unique across the tree (`run.ts`, `lens.ts`) | F | P1 | NI | G2 | RUN | ai-dlc / multi-agent-workflow / handoff; integrations: integration-2 |
| 040 | 18.4 | `pickRun` filter by module; no filter = today's result | F | P2 | RA* | 038, 039 | RUN | ai-dlc / auto-handoff / handing-off |
| 041 | 18.5 | Stages table machine-readable session column (chain id + session ids), parsed by `run.ts` and the lens | F | P1 | NI | 039, G2 | RUN, HS | ai-dlc / multi-agent-workflow / handoff; integrations: integration-2 |
| 042 | 18.6 | task-triage and product-planning rows carry the tags; a row without them is `needs-info` | F | P2 | RA* | 038 | — | ai-dlc / multi-agent-workflow / workflow-design |
| 043 | 18.7 | Moved folders leave `merged-from-<old>.md`; no record renamed | F | P2 | RA* | 039 | HS | ai-dlc / multi-agent-workflow / handoff |
| 044 | 18.8 | This repository's taxonomy as the first declaration; tag the current version of each run state (older versions stay unchanged), backlog items and product-tree files | F | P1 | NI | 037, 038 | — | ai-dlc / multi-agent-workflow / workflow-design |
| 065 | 18.9 | Link fields between run, backlog item, task and session ids (`backlog-item`, `task`, `sessions` keys on run state; readers ignore them when absent) | F | P2 | NI | 038, 041 | HS | ai-dlc / multi-agent-workflow / handoff; integrations: integration-2 |
| 066 | 18.10 | Prioritised backlog items create run states in priority order (rule in the handoff skill and orchestrator Confirm step) | F | P2 | NI | 065, 042 | HS | ai-dlc / multi-agent-workflow / handoff |
| 045 | 19.1 | Prefactor: relax the validator guards and schema (non-AM starting stages; no software-engineer in AAW) with tests | F | P1 | NI | G2 | WF | ai-dlc / multi-agent-workflow / workflow-design |
| 046 | 19.2 | Variant (a) harness: PO ↔ AM ↔ DW + BC lifecycle in template and `aaw-review.md` | F | P1 | NI | 045 | WF | ai-dlc / multi-agent-workflow / workflow-design |
| 047 | 19.3 | Variant (b) plugin/mod: PO ↔ SA ↔ SE ↔ AM ↔ SQA ↔ CR, DW + BC; team and subagent forms | F | P1 | NI | 045 | WF | ai-dlc / multi-agent-workflow / workflow-design |
| 048 | 19.4 | Variant selection from the change set (signals + ask when unclear); orchestrator hard rule; `request-routing`; tests per signal | F | P1 | NI | 046, 047 | — | ai-dlc / multi-agent-workflow / workflow-design |
| 049 | 19.5 | Per-mode records: subagent = orchestrator writes, BC reviews each handoff; team = sender writes and verifies (replaces `handoff:129`); PO/SA/SE under N.1 | F | P1 | NI | 047, 050 | HS | ai-dlc / multi-agent-workflow / handoff |
| 050 | 19.6 | Per-handoff BC review loop: own limits and env variables in `rounds --json`, no shared budget | F | P1 | NI | 045 | WF | ai-dlc / multi-agent-workflow / loop-design |
| 051 | 19.7 | Fallback to subagents (`-p`, SDK, flag off, Copilot); consumer upgrade path; catalog + Copilot build in sync | F | P1 | NI | 048, 049 | — | ai-dlc / multi-agent-workflow / workflow-design |
| 052 | 20.1 | Spike: can a render replace one fence inside a reply, or only render beneath it? Written result + fallback; checked by the human in VS Code (manual check, as spikes 027 and 029) | F | P2 | RA | G1 | — | ai-dlc-lens / diagramming / diagramming-mods |
| 053 | 20.2 | Mermaid fences render offline (closed only, source visible, no network, cap/error → source + reason, PNG on terminal, Svg elsewhere) | F | P2 | NI | 052, G2 | LENS | ai-dlc-lens / diagramming / diagramming-mods |
| 054 | 20.3 | LaTeX math via bundled MathJax | F | P2 | NI | 053 | LENS | ai-dlc-lens / diagramming / diagramming-mods |
| 055 | 20.4 | PlantUML only with a local Java + `plantuml.jar` configured; otherwise source + notice | F | P2 | NI | 053 | LENS | ai-dlc-lens / diagramming / diagramming-mods |
| 056 | 20.5 | `THIRD_PARTY_NOTICES.md` + `ATTRIBUTION.md` entries for every idea reused; lens `validate` and `test` pass | F | P2 | RA* | 053, 054, 055 | LENS | ai-dlc-lens / diagramming / diagramming-mods |

Groups (merge one item at a time inside a group; these are merge-order rules, not blocking edges): **KA** `hooks/auto-handoff/` and `hooks/keepalive/` (030 → 031, then 032 → 033 → 034 → 035); **WF** `workflow.mjs`, schema, template (045 first, then 050, 046, 047, 037, 038); **HS** the `handoff` skill (041, 043, 049); **RUN** `run.ts` and `lens.ts` run parsing (039 → 041 → 040); **LENS** the lens `register.tsx` (053 → 054 → 055 → 056). Items of the `workflow` skill need a freshly spawned agent-manager (00c Flags).

Context checks (task-triage Step 1):
- Already implemented: none. Searched `plugins/claude/ai-dlc` and `plugins/claude/ai-dlc-lens` for `taxonomy` (no hit) and for Mermaid, PlantUML, MathJax rendering (hits are only instruction text in agent and skill files and engine typings, no renderer). Per-TTL state: `keepalive.ts` holds last-write-wins (14.1.12), no per-TTL track.
- Duplicates: none against ITEM-001 to ITEM-029 (lens scope v1). Scope overlap between 049/050 and ITEM-059 is split in section 4.
- Prior rejections: `docs/backlog/out-of-scope/` does not exist; none.

## 3. Execution waves

- **Wave 0 (before G1, running)**: tier 0 research 14.1.4-14.1.10, 14.1.17.
- **After G1, parallel**: 052 (spike 20.1).
- **Wave 2 design (G2, G3)**: architect and system-engineer per tier, tier 1 first. Needs from G2: taxonomy home (037), tree layout and run-id rule (039), session column format (041), validator design (045), PNG rasteriser licence (053).
- **Wave 3 build, tier 1, inner waves (after G3)**. Waves give the order in which items may start; merges follow the group order of section 2 (so 035 merges last in KA and 037 merges after 045, 050, 046, 047):
  - 3.1 (frontier; items of one group start in parallel but merge one at a time): 030, 032, 035 (once 14.1.17 lands), 037, 039, 045, 053
  - 3.2: 031, 033, 034, 038, 041, 043, 046, 047, 050, 054, 055
  - 3.3: 036, 040, 042, 044, 048, 049, 065
  - 3.4: 051, 056, 066
- **Tiers 2-4**: see section 4; a tier item starts when the items it depends on pass review, not the whole tier (00c).

Critical path of tier 1: G3 → 045 → 050 → 046 → 047 → 049 → 051 (six serial merges across groups WF and HS, in the WF merge order). Second: G3 → 037 → 038 → 044. Third: G1 → 052 → G2 → 053 → 054/055 → 056.

Capacity risk: 29 tier-1 items against a sprint ending 2026-10-27 is not realistic for build; G3 (task plan) decides what builds in sprint 1. Planning artifacts (brief, stories, this breakdown) are the sprint 1 deliverable until then.

## 4. Tier order of the whole scope (roots 16-28): confirmed with five corrections

| Root | Backlog item | Plan order | Verdict | Final blockers |
|---|---|---|---|---|
| 21 | ITEM-057 | tier 2, after 18 | confirmed | 18 (037, 038, 039) |
| 22 | ITEM-058 | tier 2, after 17 | confirmed; takes the lens cost fixes moved out of 17 | 17 (032, 033, 034) |
| 23 | ITEM-059 | tier 2, after 18, 19 | **corrected: also after 21.** One reason, a hard edge: the phases in root 23 name where stories, tasks and handoffs are written, which are the product tree and the `artifacts` keys root 21 defines. (The shared handoff skill and `orchestrator.md` files are a merge-order matter, not a second reason.) If the product-owner prefers 23 in parallel with 21, the edge becomes a merge-order rule and the chain 18 → 21 → 23 → 24 → 27 shortens; their call | 18, 19, 21 |
| 24 | ITEM-060 | tier 3, after 18, 21, 16 | **corrected: also after 23.** The accordion per wave run state reads the structure root 23 defines (the rule that each wave has its own run-state file, added to the handoff skill there); session charts need 18's session column and 16's numbering | 16, 18, 21, 23 |
| 25 | ITEM-061 | tier 3, after 23 | confirmed | 23 |
| 26 | ITEM-062 | tier 3, after 23 | **corrected: also after the 14.1.7 spike** (side panel and file tree) | 23, 14.1.7 |
| 27 | ITEM-063 | tier 4, after 24, 14.1.7 | confirmed | 24, 14.1.7 |
| 28 | ITEM-064 | tier 4, after 14.1.5 and G1 | **corrected: split by file group.** Hook-side items edit the same files as 16 and 17, so they run in tier 2 after 16 and 17; lens-side items follow their lens tier. The split is made when the human accepts the 14.1.5 items at G1 | 14.1.5, G1, 16, 17 |

Ownership split between roots 19 and 23 (both mention records per mode and BC review of handoffs): root 19 (ITEM-049, 050) owns the AAW lifecycles, the validator and `rounds` machinery for the per-handoff review, and the AAW record rules; root 23 (ITEM-059) owns applying them to the default AI-DLC phases and the other named lifecycles. Flagged to the product-owner to confirm.

Lens items 20, 22, 24, 25, 26, 27 share one source tree: merge in the order 20, 22, 24, 25, 26, 27. Tiers: 1 = roots 16-20; 2 = 21, 22, 23, 28 (hook-side); 3 = 24, 25, 26; 4 = 27; root 28 hook-side is tier 2, and each lens-side finding runs with the lens root it joins (22 tier 2, 24 tier 3, 27 tier 4).

## 5. Traceability: plan ACs to items

Plan AC numbers are the bullets of the plan's *Tier 1 requirements*, in order; the stories carry the final AC ids and reconcile to these.

| Root | Plan ACs | Items |
|---|---|---|
| 16 | AC1-AC6 numbering and tests | 030 |
| 16 | AC7 attribution and schema | 031 |
| 17 | AC4 per-TTL splits, AC1 per-track state (main) | 032 |
| 17 | AC1, AC2 reason instead of `off`, AC5 regression | 033 |
| 17 | AC3 5m arms from subagents, subagent labels, subagent pings | 034 |
| 17 | addendum: 1h counter | 035 |
| 17 | AC6 explanation | 036 |
| 17 | AC7 lens cost fixes | moved to root 22 (ITEM-058) |
| 18 | AC1, AC2 | 037 |
| 18 | AC3 | 038 |
| 18 | AC4 | 042 |
| 18 | AC5 | 039 |
| 18 | AC6 | 040 |
| 18 | AC7 | 041 |
| 18 | AC8 | 043 |
| 18 | AC9 | 044 |
| 18 | plan task list: "run ↔ backlog item ↔ task ↔ session ids" (no AC in the plan list) | 065 (new; product-owner to keep or drop) |
| 18 | plan task list: "prioritised items create run states in order" (no AC in the plan list) | 066 (new; product-owner to keep or drop) |
| 19 | 14.1.14 draft ACs 1, 2, 3 (guards), 11 | 045, 046, 047 |
| 19 | AC 4 (signals), 9 (orchestrator rule) | 048 |
| 19 | AC 5, 6, 8 (records per mode, naming) | 049 |
| 19 | AC 7 (own limits) | 050 |
| 19 | AC 6 fallback, 12, 13, 10 (checks, upgrade path, Copilot) | 051 |
| 20 | spike (plan: "Spike first") | 052 |
| 20 | AC1-AC5 for Mermaid, defining the shared pipeline | 053 |
| 20 | AC1, AC4, AC5 for math (AC2 and AC3 are re-tested on the shared pipeline) | 054 |
| 20 | AC1, AC3, AC4 for PlantUML, plus "no local Java and jar configured: source and a notice" | 055 |
| 20 | AC6 notices, AC7 lens checks | 056 |

## 6. Flags for the orchestrator

- Route immediately (P0): none.
- Scope or priority conflict for product-owner: none open. Corrections to the plan's tier order (section 4) are recorded, not escalated: the plan assigned the order to the product-manager's confirmation.
- Conflicts with in-progress work: the lens run (G2-G4 of scope v1) edits `plugins/claude/ai-dlc-lens/` and `THIRD_PARTY_NOTICES.md`; items 053-056 touch the same files. Build after that run's merge, or merge in the order above.
- G1 questions for the human, defaults in `brief-tier-1-sprint-1.md` section 8: Q16, Q17a, Q17b, Q18, Q19a-Q19e, Q20a, Q20b, QS. Added by this breakdown: (1) ITEM-034 fallback: the product-owner did not accept the labelled "subagent: not observable" state (it weakens decision 17, "ping subagent cache too"); the question goes to the human as Q34, default: "No. The AC stands; if the G2 spike proves it impossible, this comes back to the human"; (2) ITEM-065 and ITEM-066: the product-owner decided to keep both at P2 (decided, not a G1 question).
- Other open questions for the human (defaults in brackets): milestone of these items [Unplanned, decided by the product-owner]; whether any of roots 21-28 enter sprint 1 [no]; the full submodule and feature id list for item 044 [the plan's *Area* values].
