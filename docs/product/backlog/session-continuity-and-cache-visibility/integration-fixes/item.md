---
kind: backlog-item
epic: session-continuity-and-cache-visibility
folder: integration-fixes
root: 28
backlog-item: ITEM-064
module: ai-dlc
submodule: cache-keepalive
integrations: [integration-1, integration-2]
priority: P2
status: Backlog
milestone: Unplanned
triage: needs-info  # missing: which of the 16 findings the human accepts at G1
blocked-by: 14.1.5 audit, G1 acceptance, 16, 17; lens-side findings also the lens root they join (22, 24, 27)
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/00c-approved-plan-2026-10-24.md (tier table); docs/product/active/work-breakdown-tier-1-sprint-1.md section 4
---

# Root 28: integration-fixes

Tasks (plan): the integration fixes from the 14.1.5 audit that the human accepts at G1. Corrected tier order: split by file group when accepted; hook-side items (auto-handoff and keep-alive files) run in tier 2 after roots 16 and 17, lens-side items follow their lens tier. 14.1.5 and 14.1.4 have returned: their findings are listed below, tier-placed. Nothing is accepted yet; the human accepts at G1.

Not decomposed yet: the product-manager splits this root into atomic items in the G3 task plan, after its blockers have designs. Stories are written by the requirement-analyst when the root enters a sprint. Tier-order verdict: see the breakdown, section 4.

## Findings from 14.1.5 (integration audit) and 14.1.4 (VS Code status), tier-placed

Sources: `docs/handoffs/FEAT-20261020-ai-dlc-lens/14.1.5-research-assistant-to-orchestrator.handback.md` (paths under `plugins/claude/`; R3, R5, R8 rest on grep-only evidence, confidence Medium) and `14.1.4-research-assistant-to-orchestrator.handback.md`. Placement rule (one statement, copied elsewhere): hook-side findings are tier 2 after roots 16 and 17; each lens-side finding runs with the lens root that edits the same file (root 22 tier 2, root 24 tier 3, root 27 tier 4). Root-level contract tests (`tests/`) are tier 2 and touch no lens file. Module tag: the hook-side module (`ai-dlc` / `cache-keepalive`) with `integrations: [integration-1, integration-2]`; split per module at G3. "Both" means one hook-side task and one lens-side task.

| Id | Kind | Finding | Fix (from the audit) | Placement |
|---|---|---|---|---|
| B1 | Bug | Run-state front matter: `run.ts:92` drops a trailing ` # comment`, lens `field()` (`lens.ts:1195`) does not; the skill template writes such a comment | one shared rule or strip in lens `field()`; parity test with a commented value | both: hook-side + root test tier 2; lens-side with root 24 (tier 3) |
| B2 | Bug | Notice prefix drift: `brief.ts:14` lists `[Automatic handoff]` and `[auto-handoff]`, `lens.ts:1605` only `[auto-handoff]` | export one prefix list or add the second prefix with a test | both: export tier 2; lens import with root 24 (tier 3) |
| R1 | Risk | `RUN_VERSION` regex duplicated (`run.ts:116`, `lens.ts:2426`), no test compares them | root node test comparing the pattern text | tier 2, root test |
| R2 | Risk | Two run-state parsers (`run.ts:85,184`; `lens.ts:1192`); lens reads `started`/`created`, never written | shared fixture run.md parsed by both, in a root test | tier 2, root test (after task 18.3 (ITEM-039) and task 18.5 (ITEM-041), which change parsing) |
| R3 | Risk | Keep-alive `$.state` is one global key; lens ignores `sessionId` (grep-only evidence) | filter on `sessionId` or key cycles by it; first establish whether `$.state` is per session | lens-side with root 22 (tier 2); hook-side key change tier 2 after 17 |
| R4 | Risk | Foreign state read untyped (`register.tsx:1147`, `lens.ts:1680`) | root contract test feeding a real `trackStates()` snapshot to `noteKeepalive` | tier 2, root test, after 17 |
| R5 | Risk | Pricing duplicated: keep-alive hard-codes multipliers (`settings.ts:71-73`), lens uses `model-metadata.json` (grep-only evidence) | derive the read multiplier from the metadata file, current default as fallback | hook-side tier 2 after 17 (the lens already reads the file; root 22 takes the lens cost fixes) |
| R6 | Risk | Two settings precedence implementations | document keep-alive as owner; test both orders against one fixture | tier 2, docs request + root test |
| R7 | Risk | `RECORD_NAME` rule is lens-only (`lens.ts:1914`) | root test parsing every record in this run folder | tier 2, root test (after task 18.3 (ITEM-039) and task 18.5 (ITEM-041)) |
| R8 | Risk | `abandoned` status not handled in the lens (grep-only evidence) | lens test with `status: abandoned` | lens-side with root 24 (tier 3) |
| E1 | Enhancement | No auto-handoff chain in the lens (Sessions column, `session:`, session titles) | parse `chain` and `sessions`, draw "Session N of M" | lens-side with root 24 (tier 3), needs ITEM-041 (task 18.5) |
| E2 | Enhancement | Session number resets without a lineage entry (`register.tsx:429,996`) | covered by ITEM-030 (root 16, the numbering bug itself); no root 28 task | none |
| E3 | Enhancement | Lens shows neither `sessionId` nor `updatedAt` of the keep-alive state | show "kept warm by session X", flag stale state | lens-side with root 22 (tier 2) |
| E4 | Enhancement | `pickRun` returns none for two unclaimed active runs, no lens warning (`run.ts:170`) | lens notice | lens-side with root 24 (tier 3); overlaps ITEM-040 (18.4) |
| E5 | Enhancement | `blocked` runs never picked, resume path asks the human (`run.ts:159`) | print the blocker in the seed | hook-side tier 2 |
| E6 | Enhancement | 5m track shows "off" with no reason (`keepalive.ts:690`) | keep-alive publishes a reason code, lens prints it | hook-side overlaps ITEM-033 (17.2): fold in at G3; lens-side with root 22 (tier 2) |

Untested seams: R1, R3/R4, R7 and B1 have no test that crosses plugins; the root tests above close them.

### 14.1.4: lens core features in VS Code (14 features)

Evidence: the source table, same row numbers (path:line per row). Status read from the records, none run in VS Code: broken 0, degraded 2 (1, 2), confirmed working 0, unverified 12. No open bug is confirmed in VS Code; 3 bugs were fixed headless only (later spawn missing from its chart, a blinking "SE" placeholder, 8.2.l8.1 chart split) and need a live reload. Every manual check row (Y, Z, G, W, R, S, V, KA, K) has no recorded result. Placement: tier 4, with root 27 (VS Code runs launcher), since it decides the approved fallback; the checks need a human in VS Code and are not agent tasks. Verdicts with a human need: Y10 placement, R5, Z11 full screen, Y7 and Y8.

| # | Feature | VS Code status | Open check |
|---|---|---|---|
| 1 | Workflow pane | degraded: a pane, not a pinned band; placement not controllable | Y10 |
| 2 | Chat card | degraded: "Open flowchart" chip, no prompt-toolbar button | C1, R1 |
| 3 | Agent pane | unverified | Y7 (`x` drawing), Y8 (Esc) |
| 4 | Hand-off (edge) pane | unverified | none recorded |
| 5 | Kit pane | unverified | K1-K5 |
| 6 | Drill-in mode | unverified | Z-rows |
| 7 | Panel Type switch | unverified | unchecked |
| 8 | Anomaly detector | unverified; toast and marker look not checked | G7, G10, G18 |
| 9 | Six `/ai-dlc:lens*` commands | unverified in VS Code; headless confirmed | command-palette use |
| 10 | Settings (`lens-configure`, `lens-init`) | unverified | S1-S4 |
| 11 | Keep-alive section | unverified; may read "off" by design | confirm the 1h-only case is intended |
| 12 | Avatars | unverified; width risk | V1-V11 |
| 13 | Full screen | unverified; may only maximise the panel | Z11 |
| 14 | Minimise and restore | unverified | Y-rows |

Also (docs drift, request to documentation-writer, not an item): `ai-dlc-lens/README.md` line 9 and `MANUAL-CHECKS.md` header still name steps 8.1.2-8.6.1.l1; the run is at 8.2.l15.1 (renamed per `phase-renames-2026-10-24.json`).
