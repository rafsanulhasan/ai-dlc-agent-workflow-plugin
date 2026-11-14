---
work-item: FEAT-20261020-ai-dlc-lens
kind: g4-readiness-checklist
scope: scope v2 tier 1 (roots 16-20 and the 2026-10-25 extension 068-077), plus the step-44 items the run built
author: product-manager
date: 2026-11-13
step: 61 (brief `docs/handoffs/FEAT-20261020-ai-dlc-lens/61-orchestrator-to-product-manager.handoff.md`)
sources: run state `run.v4.4.md` (Stages, Gates and loops, Follow-ups, Housekeeping, Next action), plan `docs/plans/tier-1-sprint-1.tasks.md`, backlog `docs/backlog/backlog.md`, hand-backs and human decisions in `docs/handoffs/FEAT-20261020-ai-dlc-lens/`, `git log`
status: draft for the orchestrator's G4 gate record; no backlog status changed, nothing committed
---

# Tier 1 G4 readiness checklist

Rules used. **Tier-1 scope** is an item that the plan (`tier-1-sprint-1.tasks.md`, section 3, plus section 12 for 068-077) or a recorded human decision puts in sprint 1 or its carry list. **Done** means the build commit, a test hand-back and a review hand-back are all recorded. **Unproven** means one of those legs is missing or thin. **Carried** means a recorded decision (plan section 6 "Carry", plan 12.3 "Carry list", the S1 gate record) moved it past this run's build. **Open** means in scope, not carried by any record, and not finished. An `[MV]` live check with no recorded result is an open condition on a done item, not a reason to call the item unproven.

Evidence shorthand: step numbers are the run's step codes; hand-backs are `<step>-<agent>-to-orchestrator.handback.md` in the run folder unless the cell gives another name; commits are on `feat/ai-dlc-lens` or `main`. "Tests" cells quote the hand-back's own counts; no command was re-run for this document. Mutation testing is not set up for this stack (`CLAUDE.md`), so a "mutations" figure is a hand mutation count from a sqa hand-back.

## 1. The checklist (45 rows)

### Root 16 — auto-handoff session numbering

| ITEM | Title | Backlog status | Run steps | Build commit | Tests (hand-back) | Reviews (hand-back, verdict) | Docs status | Open conditions |
|---|---|---|---|---|---|---|---|---|
| 030 | Session N from the title, then lineage depth | none recorded (header says Backlog, `backlog.md:102`) | 16.2, 16.3, 16.4.1, 16.4.2 | 9cc7f84 | 16.3: PASS, 14/15 hand mutations killed, survivor killed by a new test; 559/0 | 16.4.1 and 16.4.2: both APPROVE (1 Warning folded into 16.2.2) | Done; docs critique 16.5 PASS r1 | none. **Done** |
| 031 | `ATTRIBUTION.md` and schema text | none recorded | 16.2.2, 16.3.2, 16.4.l1.1, 16.4.l1.2, 16.5 | f265f7d | 16.3.2: PASS, equivalence 0 diff, 5/5 mutants; 560/0, 698/0 | 16.4.l1.1 and 16.4.l1.2: both APPROVE (7 Suggestions to follow-ups); critique 16.5 PASS r1 | Done (critique PASS) | 4 Minors and the T16.2 Suggestions are in run state *Follow-ups*, low priority. **Done** |

### Root 17 — keep-alive cache status

| ITEM | Title | Backlog status | Run steps | Build commit | Tests (hand-back) | Reviews (hand-back, verdict) | Docs status | Open conditions |
|---|---|---|---|---|---|---|---|---|
| 032 | Per-TTL cache state, main loop | none recorded | 17.2, 17.2.l1.1, 17.3, 17.4.1, 17.4.2, 17.2.l2.1 | 51fedb5 | 17.3: 20/20 hand mutations killed; 591/0, 744/0 | 17.4.1 APPROVE (0B/1W/4S, Warning fixed in 17.2.l2.1), 17.4.2 APPROVE (0B/0W/2S) | Done (keepalive README, 17.5 chain) | none. **Done** |
| 033 | Per-track reason, never a bare `off` | none recorded | 17.2.2, 17.3.2, 17.4.1.l1.1, 17.4.2.l1.1, 17.5, 17.5.l1.1, 17.5.l1.2 | f9d29fe | 17.3.2: 18/18 mutations; 616/0, 744/0 | 17.4.1.l1.1 and 17.4.2.l1.1: both APPROVE; critique 17.5.l1.2 PASS r2 | Done | The status-line part is superseded by step 44 (R44.1, ITEM-092; `backlog.md:109`); step 44 reviews cover the replacement. **Done** |
| 034.c | Live check: subagent usage and transcript split | none recorded | 17.2.4, 17.3.4, 17.3.4.l1.1, 17.4.1.l3.1, 17.4.2.l3.1; live result in run state journal 2w | b5080ce (debug lines) | 17.3.4: 24/26 mutations (2 equivalent); 646/0; 17.3.4.l1.1 added register-level tests, 648/0 | 17.4.1.l3.1 and 17.4.2.l3.1: both APPROVE (standards 0B/1W/5S, Warning closed in 17.3.4.l1.1) | Done (17.5.3: no change needed) | Live result (human, 2026-10-25, journal 2w): FAIL for live usage (`split=absent` x4 with writes above 0), the finished transcript did carry the split; D2a applies. The result is in the run state only: the P2 row in `plugins/claude/ai-dlc/hooks/keepalive/MANUAL-CHECKS.md:32` has an empty result cell. **Done, with that condition** |
| 034 | Subagent writes feed per-TTL state | none recorded | 37 (build), 41.3, 41.4.1, 41.4.2 | 5a6ee17 | **thin**: 37 rewrote 7 ledger tests; 41.3:75 says "covered by the 7 rewritten ledger tests of step 37; I added nothing". No traceability table or hand mutations for AC-17.3.x | 41.4.1 and 41.4.2 review `fe7ec7c..HEAD` (steps 37-40): final APPROVE, 0 Blockers | Done (step 39 c986108; markers removed 41.5.1) | `unproven — test leg: no AC-17.3.x traceability or mutation record exists, only the 7 rewritten tests`. AC-17.3.1 may never fire (human accepted, gate record 35). **Unproven** |
| 034.a | Spike: `session.send` to an idle subagent or teammate | none recorded | none | none | none | none | none | Stretch in plan section 6; "off the lanes" in 12.3; no hand-back, no human decision moving it. **Open** (no record either way) |
| 034.b | Subagent keep-alive ping via messaging (conditional) | none recorded | none | none | none | none | none | Conditional on 034.a; listed in the carry list, plan 12.3 and section 6. **Carried** |
| 035 | 1h ping counter advances per ping | none recorded | 17.2.3, 17.3.3, 17.4.1.l2.1, 17.4.2.l2.1, 17.5.2, 17.5.l2.1 | f0ee855 | 17.3.3: 8/8 non-equivalent mutations killed (3 equivalent); 624/0, 744/0 | 17.4.1.l2.1 and 17.4.2.l2.1: both APPROVE; critique 17.5.l2.1 PASS r1 | Done (17.5.2) | AC-17.4.4 repaint: VS Code PASSED (human, journal 2u, 2026-10-25); terminal not confirmed (journal 2af: "cli did not repaint"; no later result). `MANUAL-CHECKS.md` P1 result cells are empty (`:19`). The status line it repaints was later removed by step 44 (R44.1). **Done, with that condition** |
| 036 | User explanation of cache semantics (docs) | none recorded | 39, 41.5.1, 41.6 (critique, PASS round 3) | c986108 (docs) | n/a (document checks AC-17.4.7, 17.5.1-17.5.3) | brutal-critique 41.6 PASS r3 (0 Blocker, 0 Major) and 17.5.l2.1 PASS r1 | Done: keepalive README "How the prompt cache works" | none. **Done** |
| 068 | Both tracks always shown, band and Pane buttons, summary | none recorded | 17.1.x (design), 38 (build), 41.3, 41.4.1, 41.4.2, 41.6 | 8116c19 | 41.3: whole suite 764/0 ai-dlc, 862/0 repo; band, Pane, summary, switches had no tests before 41.3 and got them there | 41.4.1 APPROVE (1 of 2 rounds), 41.4.2 APPROVE final (2 of 2 rounds; 2 Blockers fixed in 41.3.l1.2) | Done (41.5.1 removed step 37-40 markers) | Superseded in part by step 44 (status line, D13, `statusText` dropped; replaced by ITEM-092 and ITEM-093, `backlog.md:151`). **Done** |
| 076 | Keep-alive chain state: handoff chain is one session | none recorded | 38 (build), 41.3, 41.3.l1.2, 41.4.2 | e526ffd | 41.3 added T17.7 tests; AC-17.7.1 red test fixed by 41.3.l1.2 (764/0) | 41.4.2 final APPROVE, 0 Blockers (round 2 of 2) | Done | none. **Done** |

### Root 18 — taxonomy and run discovery

| ITEM | Title | Backlog status | Run steps | Build commit | Tests | Reviews | Docs status | Open conditions |
|---|---|---|---|---|---|---|---|---|
| 037 | Optional taxonomy declaration | none recorded | none | none | none | none | none | Carry: plan section 6 "root 18 build" and 12.3 "roots 18 and 19 build"; run state Features "planned (carry)". **Carried** |
| 038 | `module`/`submodule`/`feature`/`integrations[]` keys | none recorded | none | none | none | none | none | Carried, same decision. **Carried** |
| 039 | Run discovery at any depth; unique run ids (039.a, .b, .c) | none recorded | none | none | none | none | none | Carried, same decision. **Carried** |
| 040 | `pickRun` filter by module | none recorded | none | none | none | none | none | Carried. **Carried** |
| 041 | Machine-readable session column | none recorded | none | none | none | none | none | Carried. **Carried** |
| 042 | Triage rows carry the tags | none recorded | none | none | none | none | none | Carried. **Carried** |
| 043 | `merged-from-<old>.md` for moved folders (043.a, .b) | none recorded | none | none | none | none | none | Carried. **Carried** |
| 044.a | This repository's taxonomy and tags | none recorded | none | none | none | none | none | Carried (blocked by 037, 038). **Carried** |
| 044.b | CI step for `validate --artefacts` | none recorded | none | none | none | none | none | Carried. **Carried** |
| 065 | Link fields between run, item, task, session | none recorded | none | none | none | none | none | Carried. **Carried** |
| 066 | Prioritised items create run states | none recorded | none | none | none | none | none | Carried. **Carried** |

### Root 19 — AAW variants

| ITEM | Title | Backlog status | Run steps | Build commit | Tests (hand-back) | Reviews (hand-back, verdict) | Docs status | Open conditions |
|---|---|---|---|---|---|---|---|---|
| 045 | Prefactor: relax guards and schema (WF-1) | none recorded | 19.2, 19.4.l1.1, 19.3, 19.4.1, 19.4.2, 19.4.l1.2, 19.5, 19.5.1, 19.5.1.l1.1, 19.5.1.l1.2, 19.6 | df0a943, fix 2e2f2d9, merge 734b33d | 19.3: PASS, 20/20 hand mutations; 739/0. Post-merge checks 19.6: 7 checks green at 734b33d | 19.4.1 and 19.4.2 APPROVE; 19.4.l1.2 APPROVE r2; docs critique 19.5.1.l1.2 PASS r2 | In progress (README.md:58, docs/plugins.md:138 keep a marker: the `variant` command is not built) | WF-1 is one atomic unit with 046, 047 and 050. **Done** |
| 046 | AAW variant (a) harness (AAWH) | none recorded | as 045 | as 045 | as 045 | as 045 | as 045 | **Done** |
| 047 | AAW variant (b) plugin/mod (AAWP) | none recorded | as 045 | as 045 | as 045 | as 045 | as 045 | **Done** |
| 050 | Per-handoff review loop limits | none recorded | as 045 | as 045 | as 045 | as 045 | as 045 | **Done** |
| 048 | Variant selection, orchestrator rule, routing | none recorded | none | none | none | none | none | Stretch in section 6, but never built; run state Features: "048, 051 carry"; carry list 12.3. Two WF-1 Suggestions fold into it (*Follow-ups*). **Carried** |
| 049 | Records per mode, N.1 slots | none recorded | none | none | none | none | none | Carried (section 6). **Carried** |
| 051 | Subagent fallback, Copilot, upgrade path | none recorded | none | none | none | none | none | Carried (Features row). **Carried** |

### Root 20 — diagramming

| ITEM | Title | Backlog status | Run steps | Build commit | Tests (hand-back) | Reviews (hand-back, verdict) | Docs status | Open conditions |
|---|---|---|---|---|---|---|---|---|
| 052 | Spike: fence replacement vs render beneath | none recorded | 20.1.1 | none (spike) | n/a | research hand-back `20.1.1-research-assistant-to-orchestrator.handback.md` | n/a | Plan 4.5: "ITEM-052 is closed (spike 20.1.1)". **Done** |
| 053.a | Spike: rasteriser, bundle sizes, font | none recorded | 20.1.5 | none (no code kept) | n/a: `20.1.5-spike-t20.3a-result.md` | 20.1.5 hand-back; OQ3 size PASS (4.53 MiB); BSD-2-Clause licence accepted by the human (journal 2j) | n/a | PlantUML profile (053.a2) and MathJax size deferred to sprint 2 with 055 and 054. **Done** |
| 053.b | Diagramming core and offline Mermaid renderer | none recorded | 38, 41.3, 41.4.1, 41.6 | 6410eb7 | 41.3: pure diagram, renderer and pixel-oracle tests (`tests/diagram.test.ts`, `tests/lens-renderer/`); lens 561/0 | 41.4.1 final APPROVE; 2 Majors (duplicate fence, `scrubSvg`) fixed in 41.4.l1.1 | Done (step 39) | none. **Done** |
| 053.c | `registerDiagram`, six settings rows, hook tests | none recorded | 38, 41.3, 41.4.1, 41.6 | 0ccb755 | 41.3: hook tests (picture, removed note, unclosed fence, disk cache); lens 561/0 | 41.4.1 final APPROVE | Done (step 39) | AC-20.8.1 `[MV]` live check: `plugins/claude/ai-dlc-lens/MANUAL-CHECKS.md:781` D1 result cell is empty. **Done, with that condition** |
| 056 | Notices and attribution for 053 | none recorded | 38 (build only) | 554c54c | n/a (document checks AC-20.7.1, 20.7.3; AC-20.7.2 `[BV]`) | none found: neither 41.4.1, 41.4.2 nor 41.6 mentions `THIRD_PARTY_NOTICES.md` or the lens `ATTRIBUTION.md` | none | `unproven — no review or critique record covers the notices and attribution entries`. Also unverified at 17.1.48: that the resvg-js tag holds all of the wasm's source. **Unproven** |
| 054 | LaTeX math via MathJax | none recorded; backlog text says "scheduled sprint 2" | none | none | none | none | none | Moved out by the human, 2026-10-25 (journal 2h). **Carried** |
| 055 | PlantUML | none recorded; "scheduled sprint 2" | none | none | none | none | none | Moved out by the human, 2026-10-25 (journal 2g); 053.a2 runs first. **Carried** |
| 075 | Notices for 054 and 055 | none recorded | none | none | none | none | none | Sprint 2 by plan 12.6. **Carried** |

### Root 22 — Cache Lab and Context Lab (the 2026-10-25 extension, approved at S1, gate record 35)

All seven items: build in step 37, tests in 41.3 (Cache Lab pure core and pane; `tests/cache-reader`), reviews in 41.4.1 and 41.4.2 (final APPROVE, 0 Blockers), docs in step 39 (c986108) with markers removed in 41.5.1, then reshaped by steps 42 and 43 (recovered hand-backs verified in step 60). Gate: S1 approved ITEM-068 to 074, 076, 077 on 2026-10-25 (`35-human-to-orchestrator.handback.md`; run state *Gates and loops*). The umbrella ITEM-058 is not counted.

| ITEM | Title | Backlog status | Build commit | Open conditions |
|---|---|---|---|---|
| 069 | T22.a transcript reader and pricing | none recorded | 80f7642 | none. **Done** |
| 070 | T22.b Cache Lab accordion, cards, windows | none recorded | ff0f8b2 | none. **Done** |
| 071 | T22.c miss attribution and TTL mix | none recorded | f6e1e5e | none. **Done** |
| 072 | T22.d Invalidation Gallery | none recorded | 5a1c6ab | none. **Done** |
| 073 | T22.e Usage renamed Context Lab | none recorded | 2532f67 | none. **Done** |
| 074 | T22.f Keep Alive sub-accordion | none recorded | cff71f7 | none. **Done** |
| 077 | T22.g Cache Lab chain window | none recorded | dc6fe2e | 41.3 covers AC-22.8.1-22.8.3 (rows at `41.3:52` and `:55`). **Done** |

## 2. Step-44 items (live findings, G4 for step 44 already approved)

These are not tier-1 plan items. They are in the run's G4 pack because the backlog and the run state disagree on them. G4 for step 44 was approved on 2026-11-02 (record 57, `56-human-decisions.human.md`).

| ITEM | Title | Backlog status | Run evidence | Verdict |
|---|---|---|---|---|
| 092, 093, 094, 095, 096, 097 | Step-44 keep-alive and lens placement fixes | **In Progress** (`backlog.md:187-192`) | 44.2 build done, 44.3 tests done (lens 928/0 in 44.3.l2.5), 44.4.l1-l3 approved, G4 approved 2026-11-02, docs 44.5 done (commit babe63a) | **Done** per run records; backlog stale |
| 098 | Live checks M25-M31, M34, P17-P26, A1, A2 | Backlog | pending on purpose (G4 decision 3, `45-human-decisions.human.md`) | **Open** (human's live run) |
| 104 | Halted state of a running background subagent | In Progress | built and reviewed (44.2.l2.x, 44.4.l3 approved); run state: "stays In Progress until M35 is run" | **Open**: M35 not run (not confirmed live) |
| 107 | A done stage settles a failed or killed agent | Done (`backlog.md:202`, my 44.1.l2.11 edit, uncommitted) | 2789721 build, 7bccdd9 tests, 44.4.l4.3 round 3 APPROVE 0B/0W (lens plugin test 926/0) | **Done**. The S3 fix (`lens-status-43.test.tsx`, staged) and the 44.4.l4.3 records are uncommitted (git status), the commit waits for GPG; backlog says "hash not yet known" |
| 099, 100, 101, 102, 103, 105, 106, 111 | Mobile epic, test hygiene, wording, flaky test, ITEM-104 follow-ups, `runCallId` | Backlog | follow-ups created by the step-44 reviews, "Not in this sprint" | **Carried** (8 items) |

## 3. Below the table

### (a) In tier-1 scope and not done

- **ITEM-034.a** (spike, open): never run, no record, no human decision moved it. It gates 034.b. Needs: a decision to run it, drop it, or carry it explicitly. Without a decision it stays an open P1 row at G4.
- **ITEM-034** (unproven tests): built and reviewed, but its test leg is the 7 rewritten ledger tests (`41.3:75`). Needs: a sqa traceability and hand-mutation pass for AC-17.3.x, or the human's explicit acceptance of the thin coverage. Related and accepted at S1: AC-17.3.1 may never fire.
- **ITEM-056** (unproven review): built (554c54c), no review or critique covers the notices. Needs: a documentation critique of `THIRD_PARTY_NOTICES.md` and the lens `ATTRIBUTION.md` entries, and the resvg-js source-tag check the 17.1.48 research left unverified.
- **Live `[MV]` results that are empty** (items stay done, conditions open): ITEM-035 AC-17.4.4 terminal (P1 cells empty), ITEM-034.c result recorded only in the run state (P2 cell empty), ITEM-053.c AC-20.8.1 (D1 cell empty). ITEM-098 lists the step-44 checks M25-M31, M34, P17-P26 and A1, A2; ITEM-104 waits for M35.

### (b) Carried items and the decision that carried them

| Items | Decision |
|---|---|
| 037, 038, 039, 040, 041, 042, 043, 044.a, 044.b, 065, 066 (root 18) | Plan section 6 "Carry to the next sprint: the root 18 build", kept by 12.3 ("roots 18 and 19 build"); run state *Features*: "Taxonomy planned (carry)". The S1 gate record 35 approved only ITEM-068 to 074, 076, 077. |
| 048, 049, 051 (root 19, after WF-1) | Plan section 6 and 12.3 carry list; run state *Features*: "048, 051 carry". 048 was Stretch and was not built. |
| 034.b | Plan 12.3: "T17.3b stays conditional"; carry list; conditional on 034.a. |
| 054, 055, 075 | The human, 2026-10-25: "move plant UML to the backlog and schedule it for the next sprint" (journal 2g), "also latex" (2h); plan 12.6 (sprint 2 intake: 054, 055 with 053.a2 first, 075). |
| 099-103, 105, 106, 111 | Follow-ups raised by step-44 reviews, each "Not in this sprint" (`backlog.md:194-203`). |
| 058 (umbrella), 057, 059-064, 067, 067.a | Tiers 2-4 and tier 3, plan sections 7 and 8. Not counted above. Note: 058's children 069-074 and 077 are done; the umbrella row still reads Backlog. |

The sprint end date moved to 2026-11-03 (human, 2026-10-25). The run state's *Clarified intent* still says "Sprint 1 ends on 2026-10-27". Today is 2026-11-13, so every carried item is past the sprint.

### (c) Open follow-ups and housekeeping the human should know at G4

- **Docs marker pass.** Run state *Follow-ups* lists README.md:58 and docs/plugins.md:128, "drop 'the reviews of this change are still open'", and "its" to "their" at docs/plugins.md:149. The markers are still in the tree: README.md:58 and docs/plugins.md:138 (the line moved) carry **In progress** because 048 and 051 are carried, so WF-1 prose is correctly still in progress. `docs/plugins.md:18` says the lens "reviews are still open" and the README, lens README :9 and keepalive README :35 and :46 keep **In progress** markers. Whether to remove them depends on what G4 closes; this is a `documentation-writer` request after the gate (the docs-status rule), not a PM edit. Line numbers in the follow-up are stale and need re-reading.
- **ITEM-111** (new, P3): `runCallId` module-level state in `lens-status-43.test.tsx:484`; optional, from 44.4.l4.3.1.
- **Uncommitted work.** `git status` shows `lens-status-43.test.tsx` staged, the 44.4.l4.3, 44.1.l2.11, 60 and 61 records untracked or staged, `backlog.md` and `run.v4.4.md` modified. The commit waits for the human's GPG passphrase (run state *Next action*). ITEM-107's backlog text says the S3 commit hash is pending.
- **Stale worktrees.** The run state names two: `.worktrees/wf-1` (could not be removed) and `.worktrees/agent-a62622e4974e96bd0`. `git worktree list` now shows no `wf-1` worktree (the branch `feat/wf-1` still exists, merged at 734b33d) and four agent worktrees: `agent-a62622e4974e96bd0` (8e80b61), `agent-aa88daf1c3412e7f3` (8e80b61), `agent-a4bb69e2681ad5ec4` (9e224f6) and `agent-a79263c7ec9c1401d` (d8e19a8). The last two belong to the herdr run (AAWP-20261112, ITEM-108/109), not this run.
- **ITEM-104 and M35.** Stays In Progress until the human runs M35; README and ITEM-104 text say so.
- **Release gate.** Per the release-gate checklist, a release cannot proceed while a P0 for the milestone is open. No P0 is open in the backlog (`backlog.md:168`); milestone is "Unplanned" for 030-077. Open P1 items: 034.a, 034 (unproven), 098, 104. Version scheme note (auto-memory): 1.0.0-preview1 unreleased.

### (d) Corrected *Features* table for the run state

Replace the *Features* table (`run.v4.4.md:186-194`) with:

| Step | Feature | Status |
|---|---|---|
| 16 | Bug: auto-handoff session N (ITEM-030, 031) | done (9cc7f84, f265f7d; tests 16.3, 16.3.2; both reviews APPROVE; docs critique 16.5 PASS) |
| 17 | Keep-alive cache status (ITEM-032, 033, 034, 034.c, 035, 036, 068, 076) | done except 034 (unproven tests); 034.a open; 034.b carried; 033 and 068 status-line parts superseded by step 44; 034.c live check FAIL to D2a (journal 2w); AC-17.4.4 terminal not confirmed |
| 18 | Taxonomy (ITEM-037 to 044, 065, 066) | carried (plan section 6, 12.3); nothing built |
| 19 | AAW variants | WF-1 (045, 046, 047, 050) done and merged 734b33d, post-merge checks green (19.6); 048, 049, 051 carried |
| 20 | Diagramming (ITEM-052, 053.a-c, 056; 054, 055, 075) | 052, 053.a, 053.b, 053.c done (053.c AC-20.8.1 live check not recorded); 056 built, unproven (no review of the notices); 054, 055, 075 carried to sprint 2 |
| 21 | Agile skill and product tree | planned (backlog) |
| 22 | Cache Lab and Context Lab (ITEM-069 to 074, 077; umbrella 058) | done, built in steps 37-38 (80f7642 to dc6fe2e); S1 approved 2026-10-25 |
| 23-28 | Tiers 2-4 (059-064) | planned (backlog) |
| 29-33 | Other roots; 33 (ITEM-067, 067.a) tier 3 | planned (backlog); feature root 29 (329dfbb) is outside tier 1 and not checked here |
| 34 | Lens AbovePrompt fix | done (34.2-34.4; commit ef28dce) |
| 35 | S1 gate record (G1+G2+G3 for 068-074, 076, 077) | approved 2026-10-25, human |
| 36 | Lens one view | done (36.2-36.4; commit 765ded7 on main); docs owed then done in step 39 |
| 37 | Wave E1 build: T22.a-f, T17.3 | done (80f7642 to 5a6ee17); tests and reviews in step 41 |
| 38 | Wave E1 part 2: T17.6, T17.7, T22.g, T20.3b, T20.3c, T20.6 | done (8116c19 to 554c54c); T17.5 by docs; tests and reviews in step 41 (056 not reviewed) |
| 39 | Owed docs 36-38, T17.5 | done (c986108) |
| 40 | Keep-alive and band fixes | done (8c0a1d9, 6ea1059, 10af4ef); reviewed in step 41 |
| 41 | AAWP team: tests, reviews, critique for steps 37-40 | done (862/0, 764/0, 561/0; standards APPROVE, spec APPROVE, critique PASS r3; commit 544527b) |
| 42 | Two bands, Cache Lab in the agent panel | done (1302cd4; recovered hand-backs accepted after verification, step 60) |
| 43 | Lens and keep-alive rules, live fixes | done (steps 43.1-43.5; e5c7f38); critique PASS |
| 44 | Live findings R44.1-R44.23 (ITEM-092 to 098, 104-107) | G4 for step 44 approved 2026-11-02 (record 57); ITEM-092 to 097 and 107 done; ITEM-098 (live checks) and ITEM-104 (M35) open |
| 60 | Verify recovered hand-backs 41.6, 42.2, 42.5 | done (4 accepted after verification) |
| 61 | Tier-1 G4 readiness checklist | this document; the gate record follows |

## 4. Counts and disagreements

Tier-1 plan rows (45): **done 24** (030, 031, 032, 033, 034.c, 035, 036, 068, 076, 045, 046, 047, 050, 052, 053.a, 053.b, 053.c, 069, 070, 071, 072, 073, 074, 077), **unproven 2** (034, 056), **open 1** (034.a), **carried 18** (034.b; 037, 038, 039, 040, 041, 042, 043, 044.a, 044.b, 065, 066; 048, 049, 051; 054, 055, 075).
Step-44 items (separate): done 7 (092 to 097, 107), open 2 (098, 104), carried 8 (099 to 103, 105, 106, 111).

Disagreements between the backlog and the run records:

1. **No per-row status for ITEM-030 to 077.** The tier-1 table (`backlog.md:104`) has no Status column; its header text (`:102`) says Status Backlog for 030-066, and 068-077 inherit that. The run records show 24 of them built, tested and reviewed. The backlog needs a status for each (a PM action after G4; not made in this step).
2. **ITEM-092 to 097 read In Progress** (`backlog.md:187-192`; the scope-change note at `:183` says "tests and reviews are pending") while the run state records tests, three review loops, docs and G4 approved (record 57). They are Done by the run.
3. **ITEM-058 (umbrella) reads Backlog** while its children 069-074 and 077 are built.
4. **ITEM-107** is Done in the backlog but its S3 fix commit does not exist yet (uncommitted); the run state and the backlog agree on the fact, the commit hash is still to fill in.
5. **ITEM-054 and 055** text says "scheduled sprint 2" but no status or sprint field exists to carry it.
6. The run state itself is stale in places: *Clarified intent* (sprint end 2026-10-27), *Features* (section 3(d) replaces it), *Housekeeping* (worktree list, section 3(c)), and *Follow-ups* (marker line numbers).
