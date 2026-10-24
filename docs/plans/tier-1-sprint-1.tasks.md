---
work-item: FEAT-20261020-ai-dlc-lens
kind: task-plan
scope: scope v2 tier 1 (roots 16-20), plus the placement of root 33 (tier 3)
author: product-manager
date: 2026-10-24
sprint: sprint-1 (2026-10-20 to 2026-10-27)
status: draft, awaiting brutal-critique, then G3
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
| LENS | the lens `register.tsx`, `diagram.ts`, `settings.ts` | 053.b, 053.c, 054, 055, 056; then root 18's lens parts (038 lens, 039.b, 041 lens, 043.b lens), then roots 22+ |

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
| T20.4 | 054 | P2 | M | 053.c | LENS | section 4.5 |
| T20.5 | 055 | P2 | M | 053.c, 053.a | LENS | section 4.5 |
| T20.6 | 056 | P2 | S | 053 to 055 | LENS | section 4.5 |

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

**T20.4 (ITEM-054), P2, M.** MathJax in `render.mjs`, the math kind in `findFences` and hook tests, the TeX-diagram reason. ACs: AC-20.2.1 to 20.2.3.

**T20.5 (ITEM-055), P2, M.** PlantUML (`javaPath`, `plantumlJar`, trust check, the profile per 053.a). ACs: AC-20.3.1 to 20.3.3.

**T20.6 (ITEM-056), P2, S.** `hooks/ATTRIBUTION.md` created, `THIRD_PARTY_NOTICES.md` entries (beautiful-mermaid, ELK.js, MathJax, the rasteriser, the font, mermaid-inline, LaTeX Inline; claude-code-figures only if reused and its NOTICE checked), lens `validate` and `test`. ACs: AC-20.7.1 `[DC]`, 20.7.2 `[BV]`, 20.7.3 `[DC]`.

## 5. Build waves (after G3)

- **3.1 (frontier, start in parallel; merges follow the group order):** T16.1, T17.1, WF-1 (needs G2 designs, all frozen), T18.3a, T20.3a, T17.3a.
- **3.2:** T16.2, T17.2, T18.3b, T18.5, T20.3b; WF-1 merges first in WF.
- **3.3:** T17.3c, T17.4, T19.4, T19.7, T18.1, T18.3c, T20.3c.
- **3.4:** T17.3, T18.2, T18.4, T18.6, T18.7a, T19.5, T20.4, T20.5.
- **3.5:** T17.3b (if 034.a passes), T17.5, T18.7b, T18.9, T20.6.
- **3.6:** T18.10, T18.8a, T18.8b.

Critical path: G3, WF-1, 048, 051, 037, 038, 039.c, 043.a, 049. Second: G3, 032, 033, 034.c, 034, 035 (034.a and 034.b run beside it, off the path). Third: 053.a, 053.b, 053.c, 054/055, 056.

## 6. Sprint 1 cut (G3 decision)

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
- **067** (feature): tier 3, P2, blocked by 067.a, 049 (T19.5), 041 (T18.5), 060 (root 24) and the human's answers Q33a-e (defaults: counts only, no stored text, pane-hosted teammates out of scope with a notice, `team` expanded to its members, spike yes). Merges in the lens group after root 24: order 20, 22, 24, 33, 25, 26, 27 (product-owner to confirm). Not in sprint 1.
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
