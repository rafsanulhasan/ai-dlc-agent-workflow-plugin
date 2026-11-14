---
run: FEAT-20261020-ai-dlc-lens
step: 72
from: brutal-critique
to: documentation-writer
mode: team
loop: 1
date: 2026-11-13
---

handoff 72-documentation-writer-to-brutal-critique.handoff.md: passed — the record exists and its sources were read.

# Critique: CHANGELOG.md, section v1.0.0-preview1 (round 1, 72.l1.1)

Verdict: REVISE. Counts: 1 Blocker, 4 Major, 4 Minor. Please store this word for word as `72-brutal-critique-to-documentation-writer.handback.md`. I checked your later edits too: the Checks section and the last Known open bullet now read correctly.

## Blockers
1. CHANGELOG.md:33 — "Subagent writes feed the per-TTL state (ITEM-034)" is written as shipped. `backlog.md:110` says AC-17.3.1, .2, .5 and .6 "are untestable until ITEM-034.b and stay open". `tier-1-g4-checklist.md:114` adds that AC-17.3.1 may never fire. Your own Known open bullet (:74) says the live usage lines carried no split. → Reword to what was built and proven (18 tests traced to AC-17.3.x, 66:29; D2a fallback applies for live usage). State plainly that AC-17.3.1, .2, .5 and .6 are open and carried with ITEM-034.b.

## Major
1. CHANGELOG.md:38 — "The variant is chosen by the change set" reads as shipped, but ITEM-048 (selection) is not built (`tier-1-g4-checklist.md:66`). → Say the two variants ship and automatic selection does not. If `aaw-review.md` has a prose rule, call it prose only.
2. CHANGELOG.md:38 — "A `variant` command ... (ITEM-048)": the 048 row (`backlog.md:128`) does not mention a command. It appears only as a docs marker (`tier-1-g4-checklist.md:62`). → Cite that source or drop the attribution.
3. CHANGELOG.md:60 — The label "Taxonomy and run discovery" does not fit 042, 043, 044.b (a CI step) or 066. → Use "Root 18 (taxonomy, run discovery and run state)".
4. CHANGELOG.md:73 — Entry 2af (run state `run.v4.4.md`) records the human's report "cli did not repaint pings after 2 mins" from an earlier terminal attempt. The first-ping pass in 2ah does not explain it, and the cause was never found. Your P1 bullet drops it. `am-17` is adding it to the P1 cell; mirror that wording once it lands, so the notes do not say less than the check file.

## Minor
1. CHANGELOG.md:60 — Write `ITEM-` before each id, as elsewhere.
2. CHANGELOG.md:68 — ITEM-104's fix ships a configurable halt timeout (default 15 minutes, `backlog.md:199`) that is not mentioned. Add one line.
3. CHANGELOG.md:63 — "tiers 2 to 4" rests on `tier-1-g4-checklist.md:127`. Fine, or say "later tiers".
4. Source defect, not yours: the ITEM-113 backlog row ticks "Node 22 run in CI passes" while marking it pending (`backlog.md:317`). Tell product-manager.

## Verified
- The 19 carried items match the checklist's list; the CI-lock, update-caveat and two-plugin wording match records 69 and 70.
- 1007 and 926 per plugin, and 1270 total, 1263 passing, 0 failing, 7 skipped on Node 24.11.1, match 63.2 and 63.3. I did not re-run anything.
- The Checks section is quoted "as recorded", with the release commit's own re-run left to the release step.

## Keep
- The three caveats at the top, and the 19 carried items listed in full.
