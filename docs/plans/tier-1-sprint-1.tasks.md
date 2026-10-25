---
work-item: FEAT-20261020-ai-dlc-lens
kind: task-plan
scope: scope v2 tier 1 (roots 16-20), plus the placement of root 33 (tier 3)
author: product-manager
date: 2026-10-24
sprint: sprint-1 (2026-10-20 to 2026-11-03; extended 2026-10-25 from 2026-10-27, human-set end date, section 12)
review-status: rev 5.6 (2026-10-25): 12.9 point 1 resolved, fixed in step 34 (commit ef28dce; run.v4 2aj, 2am); rev 5.5 (2026-10-25): 12.9 added, open point for the S1 stop: lens AbovePrompt ui.render invalid-tree error (run.v4 2ai); rev 5.4 (2026-10-25): 12.2 ITEM-076/077 note says the stories, spec delta and design are in the S1 pack, as 12.7 does; rev 5.3 (2026-10-25): 12.5 heading says decided, 12.7 says the stories and design are in the S1 pack; rev 5.2 (2026-10-25): 12.5 lead-in says decided, 12.7 points to 12.5 point 4; rev 5.1 (2026-10-25): point 4 of 12.5 and its 12.7 mirror recorded as decided (human 2p: 076 and 077 in the same combined S1); rev 5 (2026-10-25): point 4 moved into 12.5, 12.7 self-reference removed; rev 4 (2026-10-25): 12.8 closed-point sentence, 067 merge order (22 before 20); rev 3 (2026-10-25): section 12 fixed after gate critique round 2 (AC ranges, spec rev 4.5 tokens, chain.ts, stale cross-references, H1 sitting 2026-10-29); critique round 3 pending
status: G3 approved for sections 1-11 (build under way); section 12 (extension, 2026-10-25) is a draft for the combined G1+G2+G3 stop
inputs: the five specs and LLDs in docs/specs/ (auto-handoff-session-numbering, keepalive-cache-status, taxonomy, aaw-variants, diagramming); ADR-0001 to ADR-0005; docs/product/active/work-breakdown-tier-1-sprint-1.md; backlog ITEM-030 to ITEM-067 (docs/backlog/backlog.md)
---

# Task plan: scope v2, tier 1 (roots 16-20)

Every task cites its LLD section. Each LLD's own task table (section 7 to 11) is the source for scope, ACs and test seams; this plan adds the build order, the merge groups, the spikes and the gate dependencies. AC ids are the specs' ids.

## 1. Conventions for every build task

- **Chain** (00c override): `system-engineer` and `agent-manager` Align on the LLD; `agent-manager` implements and runs the checks; `sqa-engineer` writes and runs the tests; two `code-reviewer`s (conventions, intent); `documentation-writer` with `brutal-critique` for docs. Items that edit the `workflow` skill, `workflow.mjs` or its schema and templates are built by a **freshly spawned** `agent-manager` (AGENTS.md, "agent-manager changing itself").
- **Checks quoted in every hand-back:** the repository tests `node --test "tests/**/*.test.mjs"`; `node tools/build-copilot.mjs` then `--check`; `node tools/validate.mjs`; for `plugins/claude/ai-dlc/hooks/`: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`; for the lens: `plugin validate --strict` and `plugin test` of `./plugins/claude/ai-dlc-lens`; for workflow files: `node .ai-dlc/workflow.mjs validate`. The repository validates at the end of every task.
- **Red first** where a task says so: the failing test is committed and shown failing before the fix.
- **Docs:** only `documentation-writer` writes READMEs and status markers. A task that changes behaviour a README states ends with a *Docs update* request in its hand-back.
- **Sizes** are estimates in agent-sessions (S one session, M two, L three, XL eight or more, listed by sub-task); they are a planning aid and carry no commitment.
- **Triage after G3:** every task below is `ready-for-agent` once G3 is approved, except where "conditional" says otherwise.

## 2. Merge groups (one task at a time inside a group)

| Group | Files | Order |
|---|---|---|
| KA | `hooks/auto-handoff/`, `hooks/keepalive/` | 030, 031, 032, 033, 034.c, 034, 035, then 034.b (conditional on 034.a, which is not a blocker of 035); 036 (docs) after 033 and 034 |
| WF | `workflow.mjs`, schema, template, `.ai-dlc/` copies, `workflow` skill | **WF-1** (045 + 050 + 046 + 047, one atomic unit), 048, 051, 037, 038, 039.c, 043.a-workflow, 065 (`checkLinks`) |
| HS | the `handoff` skill (and `orchestrator.md` text) | 041, 043.a-text, 049, 065 text, 066 |
| RUN | `run.ts`, `lens.ts` run parsing | 039.a, 039.b, 041 (parse), 038 (its `run.ts` and lens tag fields, after 037), 040 |
| LENS | the lens `register.tsx`, `diagram.ts`, `settings.ts` | 053.b, 053.c, 056 (054 and 055 moved to sprint 2, section 12.6); then root 18's lens parts (038 lens, 039.b, 041 lens, 043.b lens), then roots 22+ |

Notes:
- **WF-1 is atomic.** A validator that rejects `AAW` and requires `handoffReview` cannot land before the template and this repository's `.ai-dlc/` copies carry `AAWH`, `AAWP`, `routing.agentArtifact` and `handoffReview` (bc's root 19 Blocker; `workflow.test.mjs:40/:47`). It is one branch, one freshly spawned agent-manager, one merge, with the full check set quoted at its end. ITEM ids stay as sub-tasks 045.a to 045.c for traceability.
- **Root 19 before root 18 in WF** (se's order): 045, 050, 046, 047, 048, 051, then 037, 038. The breakdown's older WF order (045, 050, 046, 047, 037, 038) is superseded because 048 and 051 also edit the `workflow` skill.
- **HS:** 041 then 043 then 049. 049 depends on WF-1 (its naming test reads the schema) and takes its HS place after 043.
- **LENS vs root 18's lens work** (diagramming LLD, section 8): root 20 merges before root 18's lens parts. This is a merge-order rule, not a blocking edge: if root 20 slips, 18's lens parts merge first and root 20 rebases.
- **In-progress work:** the lens run of scope v1 edits `plugins/claude/ai-dlc-lens/` and `THIRD_PARTY_NOTICES.md`. LENS tasks start after that run's merge, or merge in this order.

## 3. Task table

Pri = priority, Size = estimate, Blocked by = hard edges; "(merge order)" marks a merge-order rule, not a blocking edge (all tasks also wait for G3; "G2-OQn" means a G2 answer (none open: G2 is approved)). Lifecycle for all: AAW with the override chain above.

| Task | ITEM | Pri | Size | Blocked by | Group | Seam / checks |
|---|---|---|---|---|---|---|
| T16.1 | 030 | P1 | M | G3 | KA | section 4.1 |
| T16.2 | 031 | P1 | S | 030 | KA | section 4.1 |
| T17.1 | 032 | P1 | L | G3 | KA | section 4.2 |
| T17.2 | 033 | P1 | L | 032 | KA | section 4.2 |
| T17.3c | 034.c | P1 | S | 033 | KA | live [MV], section 4.2 |
| T17.3 | 034 | P1 | M | 034.c | KA | section 4.2 |
| T17.3a | 034.a | P1 | S | G3 (no code kept; may start on day 1) | spike | spike, section 4.2 |
| T17.3b | 034.b | P1 | M | 034.a pass | KA | conditional, section 4.2 |
| T17.4 | 035 | P1 | S | 033 (merge order: after 034) | KA | section 4.2 |
| T17.5 | 036 | P2 | S | 033, 034 | docs | documentation-writer |
| WF-1 | 045 + 050 + 046 + 047 | P1 | XL (8 sessions, section 4.3) | G3 | WF | section 4.3 |
| T19.4 | 048 | P1 | M | WF-1 | WF | section 4.3 |
| T19.7 | 051 | P1 | M | WF-1, 048 | WF | section 4.3 |
| T18.1 | 037 | P1 | M | G3; (merge order) after 051 | WF | section 4.4 |
| T18.2 | 038 | P1 | L | 037 | WF, RUN | section 4.4 |
| T18.3a | 039.a | P1 | M | G3 | RUN | section 4.4 |
| T18.3b | 039.b | P1 | M | 039.a | RUN | section 4.4 |
| T18.3c | 039.c | P1 | M | 039.a; (merge order) after 038 | WF | section 4.4 |
| T18.5 | 041 | P1 | M | 039.a | HS, RUN | section 4.4 |
| T18.4 | 040 | P2 | S | 038, 039.a, 041 | RUN | section 4.4 |
| T18.6 | 042 | P2 | S | 038 | text | section 4.4 |
| T18.7a | 043.a | P2 | M | 039.c, 041 | WF, HS | section 4.4 |
| T18.7b | 043.b | P2 | S | 043.a | LENS | section 4.4 |
| T19.5 | 049 | P1 | M | WF-1; (merge order) after 043.a | HS | section 4.3 |
| T18.9 | 065 | P2 | M | 038, 041 | HS, WF | section 4.4 |
| T18.10 | 066 | P2 | S | 065, 042 | HS | section 4.4 |
| T18.8a | 044.a | P1 | M | 037 to 043, 065 | product data | section 4.4; written by product-manager |
| T18.8b | 044.b | P1 | S | 044.a, 038, 039 | CI | agent-manager, AAWP form |
| T20.3a | 053.a | P2 | M | 052 closed, G3 | spike | section 4.5 |
| T20.3b | 053.b | P2 | L | 053.a | LENS | section 4.5 |
| T20.3c | 053.c | P2 | M | 053.b | LENS | section 4.5 |
| T20.4 | 054 | P2 | M | 053.c | sprint 2 (backlog; moved out 2026-10-25) | section 4.5 |
| T20.5 | 055 | P2 | M | 053.c, 053.a | sprint 2 (backlog; moved out 2026-10-25) | section 4.5 |
| T20.6 | 056 | P2 | S | 053 (sprint 1); the 054 and 055 notices move to ITEM-075 (sprint 2) | LENS | section 4.5 |

## 4. Task detail

### 4.1 Root 16 (LLD: auto-handoff-session-numbering.lld.md)

**T16.1 (ITEM-030), P1, M.** Scope: `config.ts` (`parseTitle`, `baseName`, `numbering`, `numberingNotice`; LLD section 2), `register.tsx` (`readLineage`, the `handoff()` order, `transcriptFor`, `steps` toast parameter, seed step; LLD 3), the engine `failStore` option (LLD 5). Red first: the two pinned tests are replaced (`auto-handoff.test.tsx:693-705`, `:1766-1774`). If split: 030.a `config.ts` plus `config.test.ts`; 030.b the wiring plus the engine tests.
- ACs: AC-16.1.1, 16.1.2, 16.2.1 to 16.2.8 (16.2.5b design-level), 16.3.1 to 16.3.5, 16.4.1, 16.4.2, 16.5.1.
- Seams: pure rows in `tests/config.test.ts`; wiring in `tests/auto-handoff.test.tsx` `describe('session names')` via `engine(...)` with `failStore`. Observables: `calls.renamed`, the chain-round answers' `sessionTitle`, the seeded `lineage:<new>` record, `calls.written[LOG_FILE]`, `band($)`, `calls.toasts`. Test names start with the AC id (LLD 5 table).
- Done when: the table of LLD 3.5 holds; `plugin test` passes; `numbering fallback:` appears once per failure.

**T16.2 (ITEM-031), P1, S.** Scope: `ATTRIBUTION.md` *Session names* entry; the naming description in `skills/configure-auto-handoff/templates/auto-handoff.schema.json` and its `.ai-dlc/` copy (byte-identical); `configure-auto-handoff/SKILL.md:74-75` follows; a byte comparison plus a `title` and `main session` check added to `tests/auto-handoff/auto-handoff-agreement.test.mjs`.
- ACs: AC-16.5.2 (document check), AC-16.5.3 (test). Agent artifacts: built by agent-manager.

### 4.2 Root 17 (LLD: keepalive-cache-status.lld.md)

**T17.1 (ITEM-032), P1, L.** `hooks/keepalive/cache-state.ts` (ledger, `observe`, `observePing`, `seedMain`, `cacheView`, `hhmm`, LLD 2), `Track.part`, the ledger replacing `lastSplit` in `keepalive.ts`, `splitFromTranscript` returning `{ split, at }`. Main usage forwarding in `register.tsx` unchanged.
- ACs: AC-17.1.1, 17.1.3, 17.1.4, 17.1.5, 17.3.4 (pure), D1 landed ping.
- Seams: new `tests/cache-state.test.ts` (pure table), `keepalive.test.ts` with the mock clock (`clock.fire`, `START`), helper `usageOf`. Pinned tests: the roughly 50 anchored line assertions are rewritten to `part(track)` in T17.2 (LLD 7).

**T17.2 (ITEM-033), P1, L.** `reasonText`, `lineOf`, `render/publish(now)` at about 15 call sites, the Stop no-tasks branch, turn-start and session-end parts, the `caches?` field in the published type (LLD 3.3, 3.4, 3.6). Red first: AC-17.2.2 (a warm 5m cache with no tasks renders the cache, not `off`). The mechanical test churn (LLD 7, "Pinned tests that change") is part of this task.
- ACs: AC-17.2.1 (every reason row; sweep that no line ends `: off`), 17.2.2, 17.2.3, published state.
- Done when: no rendered or published line matches `/: off$/`; E1 to E7 strings match.

**T17.3c (ITEM-034.c), P1, S, live [MV].** First task of 034. Add the two debug log lines (LLD 3.7). Then `sqa-engineer`, with the human watching (the human is needed once, right after T17.2 merges and before T17.3 starts; if not available by then, T17.3 and everything after it in KA carry to the next sprint, and nothing is assumed about the result), runs one subagent response and one `SubagentStop` and records whether the split is present. Result in the run folder. On a fail, D2a applies (`subagents: split unknown`); if no subagent usage is seen at all, it returns to the human.
- Seam: a keep-alive test asserts the `agent usage ... split=` log line with and without a split; the live step is manual.

**T17.3 (ITEM-034), P1, M.** `noteUsage($, usage, agentId)`, the `register.tsx` forwarding (usage out of the `!e.agentId` test; auto-handoff accounting keeps its main-only filter), `SubagentStart/Stop/TeammateIdle` handlers, `armUntil` over main only, `onlyAgentsWarm`, `splitFromAgentTranscript`, new AC-17.3.7 and 17.3.8.
- ACs: AC-17.1.2, 17.3.3, 17.3.7, 17.3.8, D2a, SubagentStop fallback, forwarding test in `auto-handoff.test.tsx`.
- Conditional on build confirmation: the hook event names and fields (`agent_id`, `agent_transcript_path`) against the installed Claude Code (LLD 3.7); a missing event moves the affected AC to the human with the finding.

**T17.3a (ITEM-034.a), P1, S, spike.** Run by `sqa-engineer`: `$.session.send` to an idle subagent and to an idle teammate. Record cache read and write, cost against the main ping (threshold at most 2x), tool calls or messages made, visible turns (threshold none). Thresholds are the human's (G2 OQ3). Output: a written pass/fail per threshold in the run folder. No production code is kept.

**T17.3b (ITEM-034.b), P1, M, CONDITIONAL on 034.a.** `pingSubagents` setting (trust-gated; `AI_DLC_KEEPALIVE_PING_SUBAGENTS`, default false), `pingRound`, `AgentPinger`; README table, `cache-keepalive-configure` schema and the `keepalive-settings.test.mjs` alignment change together.
- ACs: AC-17.3.1, 17.3.2, 17.3.5, 17.3.6.
- **Drop path:** if 034.a fails, 034.b is not built and AC-17.3.2, 17.3.5, 17.3.6 go back to the human with the spike result. Nothing else in root 17 changes.

**T17.4 (ITEM-035), P1, S.** `first ping at` in the running text (LLD 3.5), characterisation tests renamed to cite AC ids, and the AC-17.4.4 manual check (`MANUAL-CHECKS.md` row by the implementer). Red first: AC-17.4.5.
- ACs: AC-17.4.1 to 17.4.6.

**T17.5 (ITEM-036), P2, S.** Docs update request to `documentation-writer` (README cache semantics, the `warm until` difference noted in LLD 9 Q4) and `ATTRIBUTION.md` entries by the implementer. ACs: AC-17.4.7, 17.5.1 to 17.5.3 (document checks). Status marker from the run state, per the documentation rule.

### 4.3 Root 19 (LLD: aaw-variants.lld.md)

**WF-1 (ITEMS 045, 050, 046, 047), P1, XL = 8 sessions (045.a L=3, 050.b M=2, 046/047.c L=3), one atomic unit.** Plus the rewrite of the 67 `AAW` references in `workflow.test.mjs`, counted inside 045.a. Sub-tasks in this order, one branch, one merge, one freshly spawned agent-manager:
- 045.a: guards G1 to G6, list-valued routing key, `variant` field, legacy error, schema fragments, guard tests (LLD 2.1 to 2.3, 3).
- 050.b: `handoffReview` key and validation, `ROW_ENV`, the `rounds` row, schema, tests AC-19.5.x (LLD 2.3, 2.4, 3).
- 046/047.c: template `AAWH` and `AAWP`, routing list, `routing.agentArtifact`, `handoffReview`, clarify rows, `aaw-review.md` rounds and limits, this repository's `.ai-dlc/` copies, naming test (LLD 4, 5.1).
- ACs: AC-19.1.1 to 19.1.4, 19.3.1 to 19.3.4, 19.5.1, 19.5.2, 19.6.2, 19.8.1, OQ1 links; `[DC]` rows AC-19.1.5, 19.6.1 read against LLD 5.
- Seams: `tests/workflow/workflow.test.mjs` and `handoff-naming.test.mjs` (`node:test`, temporary workflow files from the template). Existing AAW tests change in this task (LLD 7, "Existing tests that change"); the build counts them with `grep -c AAW`.
- Done when: `node .ai-dlc/workflow.mjs validate` exits 0 on this repository, the suite passes, `node tools/build-copilot.mjs --check` passes. The five D10 commands are quoted (AC-19.9.1).
- LLD open point: the spec says `docs` and `critique` follow `code-review`; the LLD has them `after: ["change"]` in parallel. Resolved by sa in the spec before build; this task follows the spec as frozen at G2.

**T19.4 (ITEM-048), P1, M.** `variant` command, `globToRegExp`, `--exclude`, D4a and D4b, orchestrator and `request-routing` text, mode choice. ACs: AC-19.2.1 to 19.2.4, AC-19.4.4 (mode choice), AC-19.7.1 and 19.7.2 (the orchestrator hard rule, its AGENTS template source, and `aaw-review.md` change kinds, rounds and findings for both variants), and the variant signal cases. Seam: CLI `variant` on temporary trees.

**T19.7 (ITEM-051), P1, M.** `merge --migrate`, `LEGACY_AAW`, the *Legacy AAW* upgrade step, fallback text (5.3a), consumer upgrade tests; catalog and Copilot build stay in sync. ACs: AC-19.8.2, AC-19.4.3 (fallback), the upgrade path.

**T19.5 (ITEM-049), P1, M.** `handoff` skill (naming, who verifies, the matrix), `agent-manager` and `brutal-critique` text, naming test. ACs: AC-19.4.1, 19.4.2, 19.4.5, 19.6.1, 19.6.2 (`[DC]` against LLD 5.2 to 5.4 and section 6). HS group, after 043.a.

### 4.4 Root 18 (LLD: taxonomy.lld.md)

**T18.1 (ITEM-037), P1, M.** `taxonomy.schema.json`, `checkTaxonomy`, `validate` wiring, `workflow` skill taxonomy section. ACs: AC-18.1.1 to 18.1.4, 18.2.1 to 18.2.3. No declaration means unchanged output (pinned by AC-18.2.1).

**T18.2 (ITEM-038), P1, L.** `checkArtefacts` and `checkTags`, `--artefacts`, the readers, run-state tag fields in `run.ts` and the lens. ACs: AC-18.3.1, 18.3.3, 18.3.4. Its `run.ts` and lens tag fields merge in the RUN group after 037 and 041, before 040.

**T18.3a/b/c (ITEM-039 split), P1, M each.** 039.a `run.ts`, the shared fixture and `walkRunFolders` in auto-handoff (RUN first); 039.b the lens adapter; 039.c `workflow.mjs` `runs` command and the unique-id check (WF, after 038). Shared fixture equality is `fixture-copies.test.mjs`. ACs: AC-18.5.1 to 18.5.3, with AC-18.5.2 (`[DC]`, the `handoff` resume-scan text) in 039.a.

**T18.5 (ITEM-041), P1, M.** `parseSessions`, `StageRow.sessions`, the lens `parseRun`, the `Chain:` line, skill text. ACs: AC-18.7.1 to 18.7.3.

**T18.4 (ITEM-040), P2, S.** `pickRun` filter and the `runModule` setting with its alignment files. ACs: AC-18.6.1, 18.6.2.

**T18.6 (ITEM-042), P2, S.** `product-planning` and `task-triage` text. ACs: AC-18.3.2 and AC-18.4.1 (`[DC]`, formats and columns).

**T18.7a/b (ITEM-043 split), P2.** 043.a `move-run` (the `workflow.mjs` part joins WF; `handoff` rule text joins HS); 043.b lens `movedHomeOf`. ACs: AC-18.8.1 to 18.8.3.

**T18.9, T18.10 (ITEM-065, 066), P2.** 065: `tasks:` key, `Run` column, `taskRows`, `checkLinks`, text. 066: priority-order rule in the orchestrator and `handoff`. ACs: AC-18.9.1, 18.9.2, 18.10.1.

**T18.8a (ITEM-044.a), P1, M, written by product-manager (product data, not an agent artifact).** `.ai-dlc/taxonomy.json`; the tags on the current run-state versions (older versions stay unchanged), backlog items and the 11 files of LLD section 9; the legacy `docs/product/ai-dlc-lens/stories.md` tagged ai-dlc-lens / agent-workflows until root 21 migrates it (open question for sa/po, LLD 12 Q1). ACs: AC-18.11.1, 18.11.2 (`validate` and `validate --artefacts` exit 0 on this repository). Product-owner decision (2026-10-24): `backlogItems` does not read the backlog table; the checked tag source is the item.md / tasks.md front matter. 044.a still fills the backlog `Tags` column so every row carries epic, module and submodule (checked by the product-owner reading the backlog), and the table and front matter are kept in sync (the `review-backlog` step of `product-planning` flags a mismatch). A validator for the table is a follow-up for root 21 (ITEM-057).

**T18.8b (ITEM-044.b), P1, S.** New CI step in `.github/workflows/validate.yml` running `node .ai-dlc/workflow.mjs validate --artefacts`, built by agent-manager (AAWP form, it is code).

### 4.5 Root 20 (LLD: diagramming.lld.md)

**ITEM-052 is closed** (spike 20.1.1). The live surface check is AC-20.8.1 in 053.

**T20.3a (ITEM-053.a), P2, M, spike (may split 053.a1 rasteriser and sizes, 053.a2 PlantUML profile).** Confirms the resvg WebAssembly package, licence, size and offline load; the PlantUML security profile; bundle sizes with ELK and MathJax; the bundled font. Threshold from spec OQ3: unpacked `renderer/` above 15 MB, or a licence beyond MIT, EPL-2.0, Apache-2.0, MPL-2.0 and the font's, returns to the human with the numbers. Output: a written result in the run folder. Decides LLD 3.2, 3.3 and the font.

**T20.3b (ITEM-053.b), P2, L.** `diagram.ts` pure functions (`findFences`, `sanitiseSource`, `layoutParts`, `mermaidKind`, `texKind`), the `renderer/` (`render.mjs`, vendor bundle, rasteriser per 053.a), cache, caps, fallbacks, the offline tests. Seams: `tests/diagram.test.ts`, `tests/lens-renderer/*.test.mjs` (`node:test`, root, never shipped).
- **OQ1 resolved at G2 (default): the picture goes right after its fence.** `layoutParts` implements `afterFence` only; the `belowReply` layout, its tests and the `diagramLayout` setting's second value are dropped (the setting row is removed unless the LLD needs it for a later choice; the build confirms with sa).
- ACs: AC-20.1.4, 20.1.5, 20.4.1 to 20.4.3, 20.5.1 to 20.5.3, 20.6.1 to 20.6.4, mermaid kinds, font, render budget.

**T20.3c (ITEM-053.c), P2, M.** `registerDiagram`, the six `settings.ts` rows, hook tests, `MANUAL-CHECKS.md` steps (AC-20.8.1, live in VS Code), README Docs update request.
- **OQ1 resolved:** the placement tests AC-20.1.1 and AC-20.1.3 are written for `afterFence` only, with no `belowReply` variants.
- ACs: AC-20.1.1 to 20.1.3, 20.9.1, 20.9.2, 20.8.1 `[MV]`.

**T20.4 (ITEM-054), P2, M. Sprint 2 (moved out 2026-10-25).** MathJax in `render.mjs`, the math kind in `findFences` and hook tests, the TeX-diagram reason. ACs: AC-20.2.1 to 20.2.3.

**T20.5 (ITEM-055), P2, M. Sprint 2 (moved out 2026-10-25).** PlantUML (`javaPath`, `plantumlJar`, trust check, the profile per 053.a). ACs: AC-20.3.1 to 20.3.3.

**T20.6 (ITEM-056), P2, S.** Re-scoped 2026-10-25 to 053 only: `hooks/ATTRIBUTION.md` created, `THIRD_PARTY_NOTICES.md` entries (beautiful-mermaid, ELK.js, the rasteriser, the font, mermaid-inline; claude-code-figures only if reused and its NOTICE checked), lens `validate` and `test`. The MathJax, LaTeX Inline and PlantUML entries are ITEM-075 (sprint 2). ACs: AC-20.7.1 `[DC]`, 20.7.2 `[BV]`, 20.7.3 `[DC]`.

## 5. Build waves (after G3)

- **3.1 (frontier, start in parallel; merges follow the group order):** T16.1, T17.1, WF-1 (needs G2 designs, all frozen), T18.3a, T20.3a, T17.3a.
- **3.2:** T16.2, T17.2, T18.3b, T18.5, T20.3b; WF-1 merges first in WF.
- **3.3:** T17.3c, T17.4, T19.4, T19.7, T18.1, T18.3c, T20.3c.
- **3.4:** T17.3, T18.2, T18.4, T18.6, T18.7a, T19.5 (T20.4 and T20.5 moved to sprint 2).
- **3.5:** T17.3b (if 034.a passes), T17.5, T18.7b, T18.9, T20.6.
- **3.6:** T18.10, T18.8a, T18.8b.

Critical path: G3, WF-1, 048, 051, 037, 038, 039.c, 043.a, 049. Second: G3, 032, 033, 034.c, 034, 035 (034.a and 034.b run beside it, off the path). Third: 053.a, 053.b, 053.c, 056 (054 and 055 moved to sprint 2).

## 6. Sprint 1 cut (G3 decision)

> Superseded in part on 2026-10-25: the sprint now ends 2026-11-03 (section 12). The Stretch list below (T17.3c, T17.3, T17.5) is now Commit, per the human; the root 20 build (T20.3a to T20.6) moves out of Carry into Commit (section 12.3). The rest of the Carry list (roots 18 and 19 build, T17.3b) stands.

Sprint 1 ends 2026-10-27, three days from today, and the tier has about 35 tasks. Not all can build.

**Capacity assumption (the human corrects it at G3):** sizes are S = 1, M = 2, L = 3 agent-sessions; one chain of serial work does about 4 sessions a day, so 3 days give 12 sessions per chain; chains on different files run in parallel (KA, WF, a spike chain). This is a guess, not a measurement.

| Chain | Tasks | Sessions |
|---|---|---|
| A (KA) | 030 (2) + 031 (1) + 032 (3) + 033 (3) + 035 (1) | 10 |
| B (WF) | WF-1 (8) | 8 |
| Stretch, KA | 034.c (1) + 034 (2) after 033 | 13 in all, over the 12 |

Proposed commitment:
1. **Commit:** chain A (T16.1, T16.2, T17.1, T17.2, T17.4) and WF-1. Every blocker of each Commit task is in Commit: 031 needs 030, 033 needs 032, 035 needs 033 only (it changes the running text, not subagent pinging), WF-1 needs G3.
2. **Stretch:** T17.3c and T17.3 (need the human for 034.c, section 4.2), T19.4, T17.3a (starts on day 1, no code kept), T17.5, T20.3a.
3. **Carry to the next sprint:** the root 18 build (T18.x), T19.5, T19.7, T20.3b onward, T17.3b.

The default stands if no change is requested. Reason: roots 16 and 17 are bugs a user sees, WF-1 gates the longest chain, and the root 18 and 20 builds depend on frozen designs but not on sprint 1 outputs. G2 is approved with every default: OQ1 `afterFence` (resolved in T20.3b and T20.3c), OQ3 renderer bundles at most 15 MB subject to 053.a, the root 18 `--artefacts` narrowing accepted, taxonomy.json owned by product-manager, 034.a thresholds as written.

## 7. Tier 3 placement: root 33 (ITEM-067, 067.a)

- **067.a** (spike): live `session.send` between in-process teammates and the `tool.call` SendMessage payload; written ruling on R1 and fallback. P2, `ready-for-agent`. Not blocked by tier 1 build, and may run any time after G3 (a `sqa-engineer` or agent-manager spike with the human watching).
- **067** (feature): tier 3, P2, blocked by 067.a, 049 (T19.5), 041 (T18.5), 060 (root 24) and the human's answers Q33a-e (defaults: counts only, no stored text, pane-hosted teammates out of scope with a notice, `team` expanded to its members, spike yes). Merges in the lens group after root 24: order 22, 20, 24, 33, 25, 26, 27 (one lens lane, root 22 first, then root 20, per the human on 2026-10-25, section 12.3; the rest product-owner to confirm). Not in sprint 1.
- Fallback if 067.a fails: record-name edges only (draft AC-5), which is the tier-3 minimum.

## 8. Tiers 2-4 (unchanged from the breakdown, section 4)

57 after 18; 58 after 17; 59 after 18, 19, 21; 60 after 16, 18, 21, 23; 61 after 23; 62 after 23 and 14.1.7; 63 after 24 and 14.1.7; 64 hook-side after 16 and 17. They are decomposed when their blockers have designs.

## 9. Traceability

| Root | Spec | LLD | ADRs | Tasks |
|---|---|---|---|---|
| 16 | auto-handoff-session-numbering.spec.md | auto-handoff-session-numbering.lld.md | none | T16.1, T16.2 |
| 17 | keepalive-cache-status.spec.md | keepalive-cache-status.lld.md | none | T17.1 to T17.5 incl. 034.a/b/c |
| 18 | taxonomy.spec.md | taxonomy.lld.md | ADR-0003, ADR-0004 | T18.x |
| 19 | aaw-variants.spec.md | aaw-variants.lld.md | ADR-0001, ADR-0002 | WF-1, T19.4, T19.5, T19.7 |
| 20 | diagramming.spec.md | diagramming.lld.md | ADR-0005 | T20.x |
| 33 | none (tier 3, no spec yet) | none | none | 067.a, 067 |

## 10. Open points for G3 and risks

- **Sprint cut** (section 6): accept the proposal, or name another.
- **Question for the human: the capacity guess.** Section 6 assumes S=1, M=2, L=3 sessions and about 4 sessions a day per chain over 3 days. Is that right, or what is the real throughput? The Commit and Stretch lists move with the answer.
- **G2 answers applied:** OQ1 (`afterFence`), OQ3 (bundles at most 15 MB, subject to 053.a) and the 034.a thresholds feed T17.3a, T20.3a, T20.3b and T20.3c. The spec and LLD of root 20 still describe two layouts and a `diagramLayout` setting; sa and se amend them to `afterFence` only before the build (bc's request). Until then the plan wins for T20.3b and T20.3c.
- **Four rows marked CONDITIONAL:** T17.3 (hook event names), T17.3a/T17.3b (spike result), T20.3a (size and licence limits), 067 (R1 spike).
- **LLD open questions left to sa/po:** 044.a legacy stories file tagging; D2a display overlap (LLD 17 Q5); the `docs`/`critique` parallel form in AAWP.
- **Risks:** about 50 anchored assertions change in T17.2 (mechanical, one pass); the `workflow` skill is edited by many tasks, so WF order is strict; engine facts for root 17 and root 20 come from the provisional 2.1.308 types and are confirmed at build (T17.3c, T20.3a); a checked-in vendor bundle for the lens (LLD 20 Q8) is not yet confirmed.

## 11. Docs updates (documentation-writer stages, status from the run state)

All *planned* until each root's first build task starts, then *in progress* until the run's last review stage is done: `hooks/keepalive/README.md` (root 17, T17.5 plus 034.b settings table); `README.md` and `docs/plugins.md` (root 19 AAW variants; root 18 taxonomy, tags, deep discovery, `move-run`); `plugins/claude/ai-dlc-lens/README.md` (root 20 diagramming section and settings, T20.3c); the `configure-auto-handoff` README row for `runModule` (root 18, T18.4). Root 16 needs none. Each task's hand-back carries the *Docs update* request.
## 12. Extension of sprint 1 to 14 days (2026-10-25): status-line delta and Cache Lab

Source: product-owner scope `17.1.10` and the human's answers in `run.v4.md` (Next action 2c): status line always shows both tracks with on/off buttons (or a pinned two-line bottom panel, no padding); Cache Lab definitions accepted; ALL in this sprint; sprint 1 is 14 days total; one combined G1+G2+G3 stop. Written by product-manager (task-triage), 2026-10-25. **Draft until the combined stop.**

### 12.1 New sprint end date

- **Start:** 2026-10-20. **End: 2026-11-03** (Tuesday), set by the human on 2026-10-25 (answer 1 to the 17.1.13 open points). The earlier inclusive proposal, 2026-11-02, is dropped. Frontmatter, `docs/backlog/backlog.md` and the root 22 item carry the same date.
- Today (2026-10-25) is day 6; 9 calendar days remain including 2026-11-03.

### 12.2 New items

Numbers are the next free ones (ITEM-067 was the highest). Sizes are **placeholders** (product-manager guesses on the S=1, M=2, L=3 scale of section 6); software-architect and system-engineer replace them with the LLD sizing, and the critical path is re-derived then.

| Task | ITEM | Pri | Size (placeholder) | Blocked by | Group | Scope |
|---|---|---|---|---|---|---|
| T17.6 | 068 | P2 | L (5, LLD rev 11) | 17.2.4 (LLD rev 5 gap fix, building now); T17.3 (034); stop S1 | KA | US-17.6, AC-17.6.1 to 17.6.41 (.33 status lines hidden when nothing is allowed; .34 keep-warm source note): both track lines (5m and 1h) always shown, each with the `keep warm Xh` suffix (with its source note) and `ping k/m`, even when off; a band (Terminal and Desktop) and a Pane (VS Code) with the master button and one button per track (D10, D11; a track `[on]` overrides the master, master `[on]` forces both on, master `[off]` clears and stops both; the button follows "allowed", not "running"); a click affects the current session only (`$.store`, no settings writes); when nothing is allowed (master off, or keep-alive off in settings) the status lines are hidden and the band or Pane still shows the rows and buttons. D13 (LLD rev 11, section 20 to 22): a status-line summary (`summaryOf`, surface rule, title and seed rows) chosen by the new `statusText` setting, key `statusText`, env `AI_DLC_KEEPALIVE_STATUS_TEXT` (trimmed, case-insensitive, not trust-gated; the shared test fixture sets `statusText: 'full'`). Changes the binding E4/E5 literals: spec rev 4 delta. |
| T17.7 | 076 | P2 | M (2, se-fix) | T17.6 (068: it needs the switch store); stop S1 | KA | Keep-alive chain state: an automatically handed-off chain is one combined session (human decisions 2n(3) and the combined-session principle, 2026-10-25); switches and `--session` overrides are keyed by chain id (the shared `chainIdOf($)` and `chainSessions($)` of `hooks/auto-handoff/chain.ts`, imported by `keepalive.ts`; LLD rev 10 section 19.1), `session.end` keeps the entry during a handoff: (a) master off in the handing-off session: the handed-off session starts with keep-alive ON by default, configurable; (b) master on: the switches carry over, configurable; (c) never changes the cache prefix of an automatically handed-off session. Two new settings keys (`handoff.carryOver`, default true, `AI_DLC_KEEPALIVE_HANDOFF_CARRY_OVER`; `handoff.onWhenOff`, default true, trust-gated, `AI_DLC_KEEPALIVE_HANDOFF_ON_WHEN_OFF`; `.ai-dlc/cache-keepalive.json` and `AI_DLC_KEEPALIVE_*`, `/ai-dlc:cache-keepalive-configure`); a session the human starts by hand starts clean. Files: `keepalive.ts` (chain-keyed switches, `applyHandoffSeed` for the off-at-handoff rule), `settings.ts` (`handoff.carryOver`, `handoff.onWhenOff`), `auto-handoff/register.tsx` (the seed-branch call of `applyHandoffSeed`; `register.tsx` does not export or inject the chain function, `chain.ts` is the shared file both modules import), `cache-keepalive-configure`. Closes critique 17.1.l2.1 Minor 9. ACs: US-17.7, AC-17.7.1 to 17.7.10 (`stories.delta-r4.md`); design in LLD rev 10 section 19. |
| T22.a | 069 | P2 | M (3) | S1 only (the 034 edge is dropped, answer 3); merge order: 22 merges before root 20 (soft) | LENS-22 | Transcript reader and pricing: read transcripts, prices from `.ai-dlc/model-metadata.json`, null (shown "no price") for an unpriced model; how the lens reaches that file is a design decision for sa/se. |
| T22.b | 070 | P2 | L (3) | 069 | LENS-22 | Cache Lab accordion: Saved by cache, Lost to busts, NET, plus cards Cache Hit % (token-weighted), Tokens Saved (cache-read tokens), Bust events, Median baseline (true median). |
| T22.c | 071 | P2 | M (2) | 070 | LENS-22 | Miss attribution (TTL lapse / Prefix change / Unknown) and TTL Mix (5m / 1h / unknown). |
| T22.d | 072 | P2 | M (2) | 070 | LENS-22 | Invalidation Gallery as a sub-accordion inside Cache Lab; bust events only, cap 50 with total and truncated; the turn link depends on research 17.1.12 Q2 (`promptId`). |
| T22.e | 073 | P2 | S (1) | 069 (same `lens.ts` section, soft order); S1 | LENS-22 | Rename the Usage accordion to Context Lab (label, ids and tests that name it). Split from ITEM-058 on 2026-10-25 (answer 4). |
| T22.f | 074 | P2 | M (2) | 070, 073 (soft, same file); root 17 ITEM-032 and 033 (merged); S1 | LENS-22 | Keep Alive sub-accordion inside Cache Lab, as its last child (AC-22.7.1); the keep-alive header line (`keepaliveRow`) stays unchanged (AC-22.7.7). Split from ITEM-058 on 2026-10-25 (answer 4). |
| T22.g | 077 | P2 | S (1, se-fix) | 070 (reader and `Window`); 076 (the shared `chainIdOf` / `chainSessions` in `chain.ts`, KA lane: cross-lane edge); stop S1 | LENS-22 | Cache Lab chain window: the Cache Lab `session` window resolves to all session ids of the automatic-handoff chain (the "This session" preset covers the chain). Files under `plugins/claude/ai-dlc-lens` and `tests/cache-reader`. New 2026-10-25 (combined-session principle); ACs: US-22.8, AC-22.8.1 to 22.8.3 (fixtures F6, F6h). |

- **ITEM-058 (root 22)** stays as the umbrella: Status Backlog, split into 069 to 072. Each child carries the root's tags (`ai-dlc-lens / cache-context-lab / cache-lab; integration-2`); 068 carries root 17's (`ai-dlc / cache-keepalive / statusline; integration-1`). The "rename Usage to Context Lab" and keep-alive accordion tasks in the root 22 item are not in the product-owner's items a to d; they are split on 2026-10-25 into ITEM-073 and ITEM-074 (answer 4); ITEM-058 stays the umbrella for 069 to 074.
- **Dependencies:** the hard edge on 034 is real for 068 only. For 069 to 074 the edge is **dropped** (answer 3): the lens reads transcripts and does not wait for T17.3. 074 still needs root 17's 032 and 033, already merged.
- **Merge order (answer 2, revised 2026-10-25 by the human: one lens lane): root 22 builds and merges in full first, then root 20 builds on top of it.** This reverses the section 2 LENS order (20, 22, ...) for this sprint only. Root 20's build joins the sprint (section 12.3). There is ONE LENS lane; the section 2 rule "one task at a time inside a group" holds across both roots. Two parallel lanes were rejected, so there is no rebase and no T20.R (section 12.3). Only the T20.3a spike (053.a) runs ahead, in E0, as step 20.1.5. Root 18's lens parts (038, 039.b, 041, 043.b lens) stay Carry.
- **Chain:** the section 1 chain applies. The lens items are code, so lifecycle AAWP.
- **Triage:** 073 and 074 are needs-info like the rest. All needs-info until the stories land (requirement-analyst, step 17.1.14) and the stop approves them; then `ready-for-agent`. Research 17.1.12 is closed for 068: the human settled band, Pane and buttons (`run.v4.md` 2d), so 068 is no longer conditional.
- **Docs update requests:** `hooks/keepalive/README.md` (068, with T17.5) and `plugins/claude/ai-dlc-lens/README.md` (069 to 074, and root 20 with T20.3c). Status markers from the run state.
- **T17.5 (036) changes:** it now also waits for T17.6 (068) and T17.7 (076), so the README states the always-both-lines display and the carry-over settings once.
- **ITEM-076 (T17.7) and ITEM-077 (T22.g), added 2026-10-25 (human decision 2n(3) and the combined-session principle):** 076 on root 17, KA lane, after 068, M (2); 077 on root 22, LENS lane after 074, S (1), needs 070 and 076. Sizes from se-fix. New scope: the stories (US-17.7), the spec delta (rev 4.5) and the design (LLD rev 10 section 19) are in the S1 pack (section 12.7). Tags: 076 as root 17 (`ai-dlc / cache-keepalive / statusline; integration-1`), 077 as root 22 (`ai-dlc-lens / cache-context-lab / cache-lab; integration-2`).

### 12.3 Waves for the extension

Root 20 build items now in Commit (moved out of Carry; the root 20 G3 is approved in sections 1 to 11, so they need no new stop): T20.3a (053.a), T20.3b (053.b), T20.3c (053.c), T20.4 (054), T20.5 (055), T20.6 (056), (T20.R, the rebase task, is dropped on 2026-10-25: one lens lane, root 20 branches from merged root 22; see below). Sizes stay placeholders (T20.3a M, 3b L, 3c M, 054 M, 055 M, 056 S); software-architect 17.1.16 and system-engineer 17.1.17 size in parallel.

- **Now (before the stop), in progress or queued:** 17.2.4 (rev 5 gap fix) build and review; the 034.c debug log lines and MANUAL-CHECKS P1 precondition; stories and spec rev 4 delta (17.1.14); delta LLD and sizing (17.1.16, 17.1.17); research 17.1.12. **New, wave E0 (needs no stop): the T20.3a spike (053.a) only, running now as step 20.1.5.** It is a spike (findings and a decision, size and licence limits); any scratch code is not kept and not merged. T20.3b and T20.3c wait for root 22 (one lane).
- **Human point H1 (sitting, 2026-10-29):** 034.c live check plus the AC-17.4.4 repaint check, after the debug lines merge.
- **Human point S1 (stop):** combined G1+G2+G3 for 068 to 074: stories and ACs, spec rev 4 delta, this section with the real sizes.
- **Wave E1 (after S1; two lanes in parallel: KA, and the one LENS lane; one task at a time inside each):**
  - KA lane: T17.3c (needs H1), T17.3 (034), T17.6 (068), T17.7 (076), T17.5 (036).
  - LENS lane, in this order: **root 22 first:** T22.a (069), T22.b (070), T22.c (071), T22.d (072), T22.e (073), T22.f (074), T22.g (077, needs 076 merged). 071 and 072 may swap; 073 may move up after 069 if the rename is wanted early. **Then root 20:** T20.3b (053.b), T20.3c (053.c), T20.6 (056, 053 part only); T20.4 (054) and T20.5 (055) are sprint 2. The spike T20.3a (053.a) is already done by then (E0).
  - Off the lanes: T17.3a spike; T17.3b stays conditional.
- **Wave E2 (merge):** LENS tasks merge in lane order, task by task as each is accepted; root 20's 053.b branches from the merged root 22 head, so no rebase task exists. If 053.a left scratch code on an old base, the 053.b builder starts from the spike findings, not from that code. Carry list: roots 18 and 19 build, T17.3b, T20.4, T20.5 and ITEM-075 (sprint 2, section 12.6), and any root 20 tail past 2026-11-03 (section 12.4).

### 12.4 Critical path and human-dependent points

- **Critical path to the last merge (one LENS lane):** S1, then 069 (2), 070 (3), 071 (2), 072 (2), 073 (1), 074 (2) = 12 sessions for root 22, then 053.b (3), 053.c (2), 054 (2), 055 (2), 056 (1) = 10 sessions for root 20 = **22 placeholder sessions after S1, about 5.5 days** at the section 6 guess of 4 sessions a day. 053.a (2) is done in E0 and is off the path. Cumulative end of each task after S1, in days: 069 0.5, 070 1.25, 071 1.75, 072 2.25, 073 2.5, 074 3.0, 053.b 3.75, 053.c 4.25, 054 4.75, 055 5.25, 056 5.5. Review and fix rounds are inside the sessions; nothing is added for them, so the real figure is likely longer.
- **Latest safe S1:** with 5.5 days, S1 on 2026-10-27 ends about 2026-11-01 (1.5 days spare); 2026-10-28 ends about 2026-11-02 to 2026-11-03 (no buffer); 2026-10-29 or later does not fit all of root 20. The earlier figure (2026-10-30) assumed two lanes.
- **Items at risk of carrying past 2026-11-03** (S1 on 2026-10-28, placeholder sizes): 056 (T20.6, S; ends day 5.5) and 055 (T20.5, PlantUML, M; day 5.25) are likely; 054 (T20.4, MathJax, M; day 4.75) is borderline; 053.b, 053.c (days 3.75, 4.25) are safe. Root 22 (069 to 074) is safe. The carry order if time runs out is back to front: 056, then 055, then 054. 056 needs 053 to 055 done, so a carried 055 carries 056 too; 055 needs 053.a (done). Decide at the day-4 checkpoint, not at the end. Sizes from 17.1.16 and 17.1.17 replace every number here.
- **KA lane (most fragile):** 17.2.4, debug lines, **H1**, T17.3c, T17.3, T17.6, T17.5 = 6 placeholder sessions after H1 (about 1.5 days). Outside the agents' control: H1 and the research outcome for 068. Latest safe H1 was about 2026-10-31 here (superseded by 12.8: 2026-10-29). If H1 does not happen by then, T17.3, T17.6 and T17.5 carry (T17.3c already says so) and nothing is assumed about the 034.c result.
- **Capacity:** two lanes (KA, LENS) at 4 sessions a day each is an unmeasured guess; every date moves when sizes arrive.
- **Human-dependent:** H1 and S1 only. The end date (2026-11-03) is decided.

### 12.5 Decided points for the stop

Resolved by the human on 2026-10-25: end date 2026-11-03; root 20 joins the sprint, 22 merges first and root 20 builds on it in one lane (no rebase); the 034 edge on 069 to 072 is dropped; the root 22 leftovers are in the sprint as ITEM-073 and ITEM-074. All four points are decided:

1. Resolved (`run.v4.md` 2d, 2n): the band in Terminal and Desktop and a Pane in VS Code, a click affects the current session only; status lines hide when nothing is allowed; the keep-warm text shows its source label.
2. Sizes: agreed in 12.6 (068=4, 069=3, 070=3, 071=2, 072=2, 073=1, 074=2) and 076=2 (se 17.1.32); root 20 stays placeholders.
3. Resolved by the human on 2026-10-25: ONE lens lane (root 22 fully, then root 20); two lanes rejected despite the 5.5-day estimate against 2026-11-03. The risk is accepted: root 20's tail (056, 055, maybe 054) may carry.
4. Resolved by the human on 2026-10-25 (`run.v4.md` Next action 2p): ITEM-076 and ITEM-077 are approved in the SAME combined G1+G2+G3 stop (S1) as 068 to 074; no separate stop (12.7).

### 12.6 Scope change 2026-10-25: PlantUML and LaTeX to sprint 2 (supersedes the root 20 figures in 12.3 and 12.4)

Human: "move plant UML to the backlog and schedule it for the next sprint", then "also latex to the next sprint".

- **Items.** ITEM-055 (T20.5) and ITEM-054 (T20.4) leave sprint 1 and are in the backlog, scheduled for sprint 2. ITEM-056 (T20.6) covers 053 only in sprint 1. New ITEM-075 (sprint 2, S): the notices and attribution for 054 and 055, a separate item so 054, 055 and the notices merge independently; it depends on 054, 055 and 056. The spike T20.3a part 053.a2 (PlantUML security profile) is deferred with 055, and its MathJax bundle-size measure with 054.
- **Sizes agreed** (software-architect and system-engineer, `docs/specs/cache-lab.lld.md` section 12), in sessions: 068=4, 069=3, 070=3, 071=2, 072=2, 073=1, 074=2. Root 20 stays at placeholders: 053.b=3, 053.c=2, 056=1.
- **LENS lane, one lane, in order:** 069, 070, 071, 072, 073, 074, 053.b, 053.c, 056. 053.a is done in E0.
- **Critical path (LENS lane):** 13 sessions for root 22 plus 6 for root 20 = **19 sessions after S1, about 4.75 days** at 4 sessions a day (was 22 sessions, 5.5 days). Cumulative end after S1, in days: 069 0.75, 070 1.5, 071 2.0, 072 2.5, 073 2.75, 074 3.25, 053.b 4.0, 053.c 4.5, 056 4.75. Review and fix rounds are inside the sessions, so the real figure is likely longer.
- **Latest safe S1:** 2026-10-27 ends about 2026-10-31 (about 2.25 days spare); **2026-10-28 ends about 2026-11-02 (about 1 day spare), the latest S1 with a buffer**; 2026-10-29 ends about 2026-11-02 to 2026-11-03 (no buffer); 2026-10-30 or later does not fit. It was 2026-10-27 in 12.4, so the date moves one day later.
- **At risk of carrying (S1 on 2026-10-28):** 056 (day 4.75) only if rounds run over; 053.c (day 4.5) is borderline; 053.b (4.0) and root 22 (ends day 3.25) are safe. Carry order if time runs out: 056, then 053.c. Decide at a day-3.5 checkpoint (after 074), not at the end.
- **KA lane:** 068 is now 4 sessions (system-engineer 17.1.24, was 3); the other KA tasks keep their placeholders, so the lane is about 1 session longer (about 1.75 days after H1, was 1.5). Latest safe H1 stayed about 2026-10-31 here (superseded by 12.8: 2026-10-29) (lane ends about 2026-11-02 against the 2026-11-03 end date). The LENS critical path (19 sessions) and the latest safe S1 (2026-10-28) do not move: 068 is on the KA lane.
- **Sprint 2 intake:** T20.4 (054), T20.5 (055, with 053.a2 first), ITEM-075, then the Carry list. Their ACs (AC-20.2.x, AC-20.3.x, and AC-20.7.1 to 20.7.3 for their upstreams) stay as written.

### 12.7 ITEM-076 and ITEM-077 (combined-session carry-over): critical path and latest safe S1 (2026-10-25)

- **Items (human decision 2n(3) plus the combined-session principle, sizes from se-fix).** ITEM-076 (T17.7), keep-alive chain state, KA lane after T17.6 (068), M (2). ITEM-077 (T22.g), Cache Lab chain window, LENS lane, S (1), needs 070 and 076. The split is one story set with two lanes; 076 closes critique 17.1.l2.1 Minor 9. Both are new scope: the stories (US-17.7), the spec delta (rev 4.5) and the design (LLD rev 10 section 19) are in the S1 pack.
- **KA lane after H1:** T17.3c (1), T17.3 (2), T17.6 (4), T17.7 (2), T17.5 (1) = 10 sessions, plus 17.2.4 and the debug lines (about 1) = about 2.75 days at 4 sessions a day (was about 1.75). 076 merges about 2.25 days after the lane starts, before 077 is needed (074 ends day 3.25 in the LENS lane).
- **LENS lane:** 069, 070, 071, 072, 073, 074, **077**, 053.b, 053.c, 056 = 20 sessions after S1, **about 5.0 days** (was 19, 4.75). Cumulative end after S1, in days: 069 0.75, 070 1.5, 071 2.0, 072 2.5, 073 2.75, 074 3.25, 077 3.5, 053.b 4.25, 053.c 4.75, 056 5.0. 077 sits after 074 so the cross-lane edge on 076 is met (076 merged by about day 2.25 if the KA lane starts at S1 with H1 done).
- **Critical path:** the LENS lane (20 sessions), with the edge 068, 076 into 077. **Latest safe S1 stays 2026-10-28** (ends about 2026-11-02, about 0.75 day spare); S1 on 2026-10-29 ends about 2026-11-03 with no buffer; 2026-10-30 or later does not fit.
- **KA lane:** latest safe H1 moves from about 2026-10-31 to **2026-10-30** (ends about 2026-11-02 to 2026-11-03); H1 on 2026-10-31 has no buffer.
- **Fits by 2026-11-03?** Yes on the agreed sizes, if S1 is on or before 2026-10-28 and H1 on or before 2026-10-30, and the 076/077 stories and design are in the S1 pack. Carry order if time runs out: 056, 053.c on the LENS lane; T17.5 then T17.7 on the KA lane (077 follows 076: carried together, the "This session" window then shows the single session).
- Point 4 (076 and 077 in the same combined S1): decided, see 12.5.

### 12.8 ITEM-068 grows to 5 sessions (D13 status-line summary, `statusText`), 2026-10-25

- **Change.** ITEM-068 (T17.6) goes from 4 to 5 sessions (system-engineer 17.1.37, LLD rev 11): `summaryOf`, the surface rule, the `statusText` setting (`AI_DLC_KEEPALIVE_STATUS_TEXT`), the title and seed rows. Other items unchanged. The design point on the summary tokens for `overage, stopped` and the compaction texts is closed: the tokens are decided in spec rev 4.5 (`<ttl> stopped: overage`, then `<ttl> compacting`, `<ttl> compacted`, `<ttl> compaction skipped`, `<ttl> compaction refused`; LLD rev 11, section 20.1).
- **KA lane after H1:** T17.3c (1), T17.3 (2), T17.6 (5), T17.7 (2), T17.5 (1) = 11 sessions, plus 17.2.4 and the debug lines (about 1) = 12 sessions, **about 3.0 days** at 4 sessions a day (was 2.75). 076 merges about 2.5 days after the lane starts, still before 077 is needed (074 ends day 3.25 in the LENS lane).
- **LENS lane:** unchanged, 20 sessions, about 5.0 days. **Latest safe S1 stays 2026-10-28** (the human moved the H1 sitting to 2026-10-29; the S1 stop stays by 2026-10-28).
- **Latest safe H1:** moves from 2026-10-30 to **2026-10-29** (H1 on 2026-10-29 ends about 2026-11-02 to 2026-11-03; 2026-10-30 has no buffer).
- **H1 sitting (human, 2026-10-25): 2026-10-29.** That is the latest safe H1, so the KA lane has no buffer; the S1 stop stays by 2026-10-28 (S1 does not wait for H1: it approves stories, spec and design only). The 034.c follow-ups (se-fix3, 17.1.31) change no sizes (the portable read in `readTranscript` and the fallback marker step fall inside T17.3 / 034; one guard), so the figures stand.
- **Fits by 2026-11-03?** Yes on the agreed sizes, if S1 is on or before 2026-10-28 and H1 on 2026-10-29 as set (no spare day on the KA lane). If H1 slips past 2026-10-29, the carry order on the KA lane is T17.5, then T17.7 (077 follows 076). A S1 later than 2026-10-28 does not fit by itself (the LENS lane then ends about 2026-11-04 to 2026-11-05); options for the product-owner or the human then (no scope decided here): (a) hold S1 on or before 2026-10-28; (b) accept a later S1 and carry 056, then 053.c, to sprint 2; (c) move a LENS-lane item (for example 073) to sprint 2.

### 12.9 Open points for the S1 stop

1. Resolved (human, `run.v4.md` 2aj, 2026-10-25, overriding 2ai "on the S1 agenda first": fix it right away; done in step 34, `run.v4.md` 2am, commit `ef28dce`): `register.tsx:3100` drops `width="100%"` from the AbovePrompt wrapper Box and `lens.test.tsx:2836` adds a regression test; sqa-engineer passed it, and both code-review axes approved with 0 Blockers. Nothing is left for S1. The problem was: in a live session on 2026-10-25 (debug log `.scratch/034c/repaint2.log`) the ai-dlc-lens hooks module's AbovePrompt `ui.render` was rejected about twice a second with `a hook returned a tree that does not validate (engine node under a Box with prop "width")`, and Claude Code drops the lens's above-prompt output; keep-alive's status line is not affected.
