---
run: FEAT-20261020-ai-dlc-lens
work-item: FEAT-20261020-ai-dlc-lens (scope v2), tier 1
lifecycle: AI-DLC
step: 61
from: orchestrator
to: product-manager
mode: subagent
loop: none
gate: G4 (tier 1) — preparation; the gate itself is the human's
verification: pending
date: 2026-11-13
---

# 61 orchestrator → product-manager: tier-1 G4 readiness checklist

## Goal
The run's last open gate is **G4 (tier 1)**, approver human. Before the orchestrator writes the gate record, it needs an evidence-backed list of every tier-1 item and whether it is done, so the human approves a true picture. The run state's *Features* table is stale (it stops at step 20 and shows 17 as "T17.1 building"), so it cannot be the source.

## Artifacts
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v4.4.md` — run state: *Stages* (rows per step 16-44, 60, 61), *Gates and loops* (G1-G3 tier 1 approved 2026-10-24; S1 gate record 35 approved ITEM-068 to 074, 076, 077; G4 step 44 approved 2026-11-02, record 57), *Follow-ups*, *Housekeeping* — verified: exists.
- `docs/plans/tier-1-sprint-1.tasks.md` — the tier-1 task plan (scope, commit / stretch / carry) — not opened by the orchestrator; you verify.
- `docs/backlog/backlog.md` — item statuses (your 44.1.l2.11 edit, uncommitted: 107 Done, 111 new) — verified: exists.
- The run folder's gate records and human decisions (`35-…`, `57-…`, `5*-human-decision*.human.md`).

## Gate evidence
n/a (this step prepares it)

## Open questions / risks for the receiver
- Some items were moved to carry or to later tiers by the human (run state *Next action* history, e.g. 2e, 2al). Count an item as tier-1 scope only where the plan or a recorded human decision puts it there; say which.
- ITEM-104 "stays In Progress until M35 is run" (G4 step 44 row): report it as open with that condition, not as done.

## Suggested skills
- `ai-dlc:product-planning` — release-gate checklist, backlog statuses.

## Instructions for the receiver
1. Line 1: `handoff 61-orchestrator-to-product-manager.handoff.md: passed|failed — <why>`.
2. Write the checklist to `docs/plans/tier-1-g4-checklist.md`: one row per tier-1 item — `ITEM | title | backlog status | run steps | build commit | tests (hand-back) | reviews (hand-back, verdict) | docs status | open conditions`. Every cell that claims done cites a record or commit; anything unproven is `unproven — <why>`.
3. Below the table: (a) items in tier-1 scope that are not done, with what each waits for; (b) the carried items with the decision that carried them; (c) the open follow-ups and housekeeping from the run state that the human should know about at G4 (the docs marker pass, ITEM-111, the stale worktrees); (d) a corrected *Features* table (steps 16-44 and 60-61, `Step | Feature | Status`) for the orchestrator to put in the run state.
4. Do not change backlog statuses in this step and do not commit. Report compressed: the file path, counts (done / open / carried / unproven), and any disagreement between the backlog and the run records. Next hop: the orchestrator writes the G4 gate record for the human.
