---
step: 48
from: orchestrator
to: human
run: FEAT-20261020-ai-dlc-lens
gate: G4 (step 44, fourth presentation)
approver: human
commit: 783fbb4
date: 2026-11-01
verification: pending
---

# G4 for step 44, after code review round 4 of 4 (the last round)

## Gate evidence
- Review 44.4.l2.4: the lead stopped with an API error after a partial report; both sub-reports were resent and stored verbatim (44.4.1.l2.4, 44.4.2.l2.4 hand-backs).
- Standards APPROVE 0 B / 2 W / 9 S (2 round-3 suggestions carried). Spec APPROVE 0 B / 0 W / 2 S. All round-3 findings closed except [C1a] flakiness (partial: no repeated loaded run recorded).
- Range bd2c340..783fbb4: no production code changed (both reviewers; orchestrator checked `git diff --quiet` on the lens hooks before the commit).
- Tests quoted: lens 865/0 (standards; spec runs 2-4; spec run 1 863/2, names not captured, likely concurrent load), ai-dlc 983/0 and node 876/0 (sqa 44.3.l1.7).

## Open, needing the human
1. W1 decision 8 vs code: a terminal band's mode button in a session whose own surface is VS Code takes the VS Code path (register.tsx:1333, AC-12.29 (c)). Decision 8 says a terminal / Desktop press switches pinned and docked. Which decides: the surface the press came from, or the session's own surface?
2. Mobile rules (AC-12.28 (d), AC-12.29 (f)) came from code review round 2, not from a decision of the human: ratify, or record as review-derived.
3. W2: mutant N6, listed as equivalent, is probably killed (own surface null or mobile). An sqa run would settle it and drop N6 from the known limits.

## Suggestions (no round left)
HEAVY defined in 9 test files; two local bandDrawn copies; three new `as any` casts; a describe title; the [C1a] timing comment unsourced; decision 12 ↺ half tested only by step-43 tests not tagged AC-12.30; "tests in progress" stale in stories:7 and ADR-0008:4 (both axes); "not run" vs "pending" wording; MANUAL-CHECKS ids N6 / K3 collide with mutant ids; the press-with-no-surface, K3 and N6 limits only in test comments and hand-backs; carried: step tags in names, followSeat mixes concerns. Spec: run the lens suite alone once if failures recur.

Outside step 44: tests/stop-sync-then-check.test.mjs:149 failed once on its 0.3 s timeout (44.5.l3.9), passed on rerun.

## Asked of the human
Answer 1 and 2; then approve G4 with the rest as follow-ups, or have W2 and the suggestions fixed first (no review round left: another would need the limit raised again).
