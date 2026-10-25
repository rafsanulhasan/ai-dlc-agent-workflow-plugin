---
kind: backlog-item
epic: ai-dlc-lens
folder: cache-and-context-lab
root: 22
backlog-item: ITEM-058
module: ai-dlc-lens
submodule: cache-context-lab
feature: cache-lab
integrations: [integration-2]
priority: P2
status: Backlog
milestone: Unplanned
triage: split (umbrella; children ITEM-069, 070, 071, 072, 073, 074, 077)
blocked-by: 17 (ITEM-032, 033); the ITEM-034 edge was dropped on 2026-10-25
source: docs/handoffs/FEAT-20261020-ai-dlc-lens/00c-approved-plan-2026-10-24.md (tier table); docs/product/active/work-breakdown-tier-1-sprint-1.md section 4
review-status: rev 3 (2026-10-25): stories link fixed, ITEM-077 in the summary (gate critique round 2, CL M2, m4)
---

# Root 22: cache-and-context-lab

Tasks (plan): rename Usage to Context Lab; Cache Lab with read, write, uncached, hits, misses, write cost, cost versus saved including the write premium (`lens.ts:330-336,1751-1775`); a Keep Alive sub-accordion inside Cache Lab, as its last child. Takes the lens cost fixes moved out of root 17 (its AC7). Merge order in the lens: before root 20 (changed 2026-10-25).

Decomposed on 2026-10-25 (see Split below): umbrella ITEM-058 with children ITEM-069 to ITEM-074 and ITEM-077 (Cache Lab chain window, added 2026-10-25). Stories: `docs/product/backlog/ai-dlc-lens/cache-and-context-lab/stories.md` (requirement-analyst). Tier-order verdict: see the breakdown, section 4.

## Split (product-manager, 2026-10-25)

Decomposed after the human's answers (run.v4.md, Next action 2c) and product-owner step 17.1.10. Children, all P2, all in sprint 1 as extended to 2026-11-03:
- ITEM-069 (22.a) transcript reader and pricing; ITEM-070 (22.b) Cache Lab accordion with Saved by cache / Lost to busts / NET and the hit %, tokens saved, bust events and median baseline cards; ITEM-071 (22.c) miss attribution and TTL mix; ITEM-072 (22.d) Invalidation Gallery sub-accordion.
- ITEM-073 (22.e) rename Usage to Context Lab (size 1); ITEM-074 (22.f) Keep Alive sub-accordion inside Cache Lab, last child (AC-22.7.1; size 2). Split from this item on 2026-10-25 on the human's answer; they are no longer left in ITEM-058.
- Order (LENS-22 lane, one at a time): 069, 070, 071, 072, 073, 074; 071 and 072 may swap, 073 may move up after 069. 074 depends on 070 (073 is a soft same-file order only).
- Dependencies: the ITEM-034 edge is dropped (2026-10-25): the lens reads transcripts and does not wait for T17.3. The lane starts right after the combined G1+G2+G3 stop. 074 still needs root 17's 032 and 033, already merged.
- Merge order (2026-10-25): root 22 merges first, then root 20, which builds on it (this reverses the earlier "after root 20" rule). Root 20 builds on the merged root 22 head (one lens lane). Sizes (sessions): 069=3, 070=3, 071=2, 072=2, 073=1, 074=2 (plan section 12.6).
- The status-line delta is ITEM-068 (root 17, now 5 sessions with the D13 `statusText` summary), not part of this root. Plan: `docs/plans/tier-1-sprint-1.tasks.md` section 12.
- ITEM-077 (22.g, added 2026-10-25, combined-session principle): the Cache Lab `session` window and the "This session" preset cover the whole automatic-handoff chain; size 1; needs 070 and root 17's ITEM-076 (the `chainOf` seam); LENS lane after 074.
