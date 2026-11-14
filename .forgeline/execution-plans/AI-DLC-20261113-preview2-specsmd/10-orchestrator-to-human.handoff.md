---
step: 10
from: orchestrator
to: human
date: 2026-11-14
run: AI-DLC-20261113-preview2-specsmd
stage: G3 gate (re-presented; supersedes record 7) with the G1 amendment (D69) and the G2 amendment (D65)
verification: pending
---

# Gate: G3 — task plan, bolts and stories; plus the G1 and G2 amendments

Supersedes `7-orchestrator-to-human.handoff.md`. All paths under `.forgeline/memory-bank/` in the worktree, branch `plan/preview2` (last commit ef489e4; this set is uncommitted until the decision).

## What is up for approval
1. **G3** — the task plan `project/plans/001-preview2-specsmd.tasks.md` (15 bolts, 38 stories; ~42.2 d elapsed, ~47.2 d if 012 falls back to W5; range 36–67 d, low confidence), the bolts and stories under `product/intents/001-preview2-specsmd/units/*/`, the backlog `project/backlog.md` (ITEM-111 Done, ITEM-127 new), spec delta r1.
2. **G2 amendment (D65)** — spec delta r2 (`product/specs/001-preview2-specsmd.spec.r2-delta.md`: `architecture/{decisions,narratives}/` for consumers, D64; §14 standards exception), ADR-0017 (standards are agent artifacts written by agent-manager) and the ADR-0014 pointer; AC-7.1–7.3, AC-7.5, C-10 and three glossary entries.
3. **G1 amendment (D69)** — FR-18 "the `.forgeline/` root" with AC-18.1–18.12, AC-16.4 reworded and the listed rewordings (`requirements.md`, `acceptance-criteria.md`, amendment note at its line ~277). Behaviour points: D73 (`.handoff/config.md` deleted by bolt 004), D74 + D76 (workflow gate blocks every Stop in a git repo whose workflow folder exists without `workflow.json`; escapes kept; validation of an existing file stays change-gated; silent outside git), D77 (`/…configure` refuses in the fallback state and points to `/engine:migrate`).

## Gate evidence
- Feature 8 (this repo's `.forgeline` dogfood, standards generator): change 8.2 + follow-ups, tests 1307/0 fail (8.3, 8.3.l2.1), code reviews approved 0 Blockers (8.4.x), docs critiques PASS (8.5.x); committed ef489e4 (signed) after the hooks fix 8b35a33 (signed; plugin validate --strict ×2 exit 0, plugin test 1007/0).
- Re-plan content: product-manager 1.1.32, requirement-analyst 1.1.33, architect 8.1.6; written by documentation-writer 1.5.l5.1–1.5.l5.5; link check 219 links / 0 broken; bare old-run-path grep empty.
- Gate critique (gate-critique; limit raised to 3 rounds for this run, D78): final round 1.5.l5.5.1 PASS (0 B, 0 M, 3 m), 1.5.l5.5.2 PASS (0 B, 0 M, 4 m), 1.5.l5.5.3 PASS (0 B, 0 M, 3 m).

## Open Minors (accepted into the gate record unless the human says otherwise; for bolt 015's lld)
- AC-18.6: name the folder the gate looks in for `workflow.mjs` (new path first, then old) so the intermediate state cannot block; say an invalid `workflow.json` still blocks; "except the repeat Stop" in the G1 note; how a git repo is detected (lld).
- `check-workflow.mjs` header comment describes the old silent fallback — fix with the hook in bolt 015.
- A "warn once per Stop" fixture for the intermediate state.
- plan row 015 cites only D74 — add D76, D77.
- Whether `/lens-configure` writes `lens.json` and so falls under D77 — settle in story 027's sweep.
- Carried from record 7: none open except the decisions below.

## Decisions the human gives
1. Approve G3 (plan, bolts, stories, backlog, delta r1) — including bolt 012 in W3 under the non-blocking rule.
2. Approve the G1 amendment (FR-18 with D73/D74/D76/D77) and the G2 amendment (delta r2, ADR-0017).
3. AC-16.6 (`windows-latest` job in bolt 009): accept; does a red Windows job block merge?
4. Bolt 001 spike: 2–4 h of the human's time on days 1–2 of W1?
Feature 6 follow-ups from record 7 are settled by D58 and D67.
