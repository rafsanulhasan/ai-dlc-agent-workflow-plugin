---
kind: tasks
epic: multi-agent-workflow-foundations
sprint: sprint-1
folder: taxonomy
root: 18
module: ai-dlc
submodule: multi-agent-workflow
integrations: [integration-2]
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.13-research-assistant-to-orchestrator.handback.md; plan 00c root 18
stories: stories.md (requirement-analyst)
---

# Root 18: taxonomy in the plugin

Epics sit above modules: epics are the folder level, and module, submodule, feature and integrations are front-matter tags (human decision 18). Plan ACs, in the plan's order: AC1 optional validated declaration with stable ids (home decided by the architect at G2); AC2 with no declaration every reader behaves as today; AC3 `module`, `submodule`, `feature`, `integrations[]` keys on run state, backlog items, stories, tasks, with `validate` rejecting undeclared ids; AC4 task-triage rows carry them, a row without is `needs-info`; AC5 run discovery at any depth, run ids unique across the tree (`run.ts:56-73`, `lens.ts:986`); AC6 `pickRun` filters by module; AC7 a machine-readable session column in the Stages table (chain id + session ids) parsed by `run.ts` and the lens; AC8 moved folders leave `merged-from-<old>.md`; AC9 this repository's taxonomy is the first declaration.

All items are `workflow`-skill or handoff-skill work: a freshly spawned agent-manager builds them. Merge one at a time per group (WF, HS, RUN).

| ITEM | Task | Goal and files | Covers | Blocked by | Triage |
|---|---|---|---|---|---|
| 037 | 18.1 | Declaration, schema, `validate`: a `taxonomy` section in `workflow.json` or `.ai-dlc/taxonomy.json` (G2). `TOP`/schema/validate rules (`workflow.mjs:155-156,436-439`, schema `:162-163`); absent declaration changes nothing | AC1, AC2 | G2 | needs-info |
| 038 | 18.2 | Keys on run state front matter, backlog item format (`product-planning`), story and task files; `validate` rejects undeclared ids only when a declaration exists | AC3 | 037 | needs-info |
| 039 | 18.3 | `handoffsRoot` (`run.ts:56-73`) and the one-level scan (`lens.ts:986`, `handoff/SKILL.md:288`) find runs at any depth; a duplicate run id across the tree fails `validate` | AC5 | G2 | needs-info |
| 040 | 18.4 | `pickRun` (`run.ts:162-171`) takes an optional module filter; no filter returns what it returns today | AC6 | 038, 039 | ready-for-agent after both |
| 041 | 18.5 | Stages table session column format (chain id + session ids), written by the handoff skill's template, parsed by `parseStages` (`run.ts:184-203`) and the lens `parseRun` (`lens.ts:1192-1245`); old tables without it still parse | AC7 | 039 (same files), G2 | needs-info |
| 042 | 18.6 | task-triage output table and `product-planning` item format carry the tags; a row without them is marked `needs-info` | AC4 | 038 | ready-for-agent after 038 |
| 043 | 18.7 | Rule in the handoff skill and a check: a moved run folder leaves `merged-from-<old>.md` and no record is renamed (precedent `lens.ts:1417-1430`) | AC8 | 039 | ready-for-agent after 039 |
| 044 | 18.8 | `.ai-dlc` declaration of this repository: modules ai-dlc, ai-dlc-lens, integrations; Integration 1 = auto-handoff + keep-alive, Integration 2 = ai-dlc + lens; tag the current version of each run state only (older versions are never changed, `handoff` skill *Run state*, Versions), backlog items and product-tree files | AC9 | 037, 038 | needs-info |
| 065 | 18.9 | Plan task "run ↔ backlog item ↔ task ↔ session ids": run-state keys `backlog-item`, `task`, `sessions` linking a run to its backlog item, task and session ids; readers ignore them when absent. No AC in the plan's list: story to be written if the product-owner keeps it | plan task list | 038, 041 | needs-info |
| 066 | 18.10 | Plan task "prioritised items create run states in order": at Confirm the orchestrator creates run states from backlog items in priority order (handoff skill and orchestrator rule). No AC in the plan's list; overlaps root 23 on who creates run states, so root 23 owns the default-phase wiring | plan task list | 065, 042 | needs-info |

Common tags: module ai-dlc, submodule multi-agent-workflow, feature handoff (038, 039, 041, 043) or workflow-design (037, 042, 044); 040 is submodule auto-handoff, feature handing-off. 039 and 041 carry integrations [integration-2] (the lens reads them).

Triage notes. Established so far: plan decisions above; research drafts in 14.1.13 section 4; open questions Q1-Q6 of 14.1.13 answered by the human's decision 18 except: where the declaration lives (architect, G2) and the tree layout under `docs/handoffs/` (root 21 defines the mirror tree; 039 must accept any depth so it does not wait for 21). Still needed (from the human at G1, default in brackets): the full submodule and feature id list for 044 [the plan's *Area* column values]; whether Milestone means a release and sprint is a separate key [yes, brief section 7].
