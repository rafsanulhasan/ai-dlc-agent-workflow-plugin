---
run: FEAT-20261020-ai-dlc-lens
work-item: FEAT-20261020-ai-dlc-lens (scope v2), tier 1
lifecycle: AI-DLC
step: 64
from: orchestrator
to: product-manager
mode: subagent
loop: none
gate: none (prepares G4 tier 1)
verification: pending
date: 2026-11-13
---

# 64 orchestrator → product-manager: backlog after the pre-G4 work of 2026-11-13

## Goal
Every pre-G4 task the human ordered is done and approved. Bring `docs/backlog/backlog.md` in line with the run before devops-engineer commits and before the G4 record.

## Artifacts (all in `docs/handoffs/FEAT-20261020-ai-dlc-lens/` unless a path is given) — verified: exist
- **ITEM-034** (keep-alive subagent writes): tests 17.3.l1.1 (18 tests, AC trace), review loop 17.4.l1 rounds 1-2 approved on both axes, AC-17.3.7 bug found and guarded (17.4.l1.2-agent-manager-…, reviewed 17.4.l1.2.1-code-reviewer-to-orchestrator). AC-17.3.1 / .2 / .5 / .6 untestable until ITEM-034.b (carried to sprint 2).
- **ITEM-056** (lens notices): critique loop 20.5.l1 rounds 1-2, final PASS 0B/0M (20.5.l1.2-brutal-critique-to-agent-manager.handback.md); spec / LLD elkjs licence corrected (20.1.l4.3-software-architect-…). Accepted as marked "Not verified": safer-bytes repo, compiled-in serde version, GWT code in the minified bundle, transitive crates.
- **Regression, Claude Code 2.1.323 test host** (42.2.l1.1 … 42.4.l2.1.2): 5 band tests red at HEAD; fixed test-only; approved.
- **Regression, Claude Code 2.1.323 `plugin validate`** (root 63: 63.2 … 63.4.2): both plugins fixed; approved; Node 22 run pending in CI (human: check CI before G4).
- Follow-ups gathered in `run.v4.4.md` (*Follow-ups*, *Housekeeping*, the Stages notes of 17.4.l1, 42, 63, 20.5).

## Instructions for the receiver
1. Line 1: `handoff 64-orchestrator-to-product-manager.handoff.md: passed|failed — <why>`.
2. ITEM-034 and ITEM-056 → **Done** (2026-11-13), citing the records above; ITEM-034's row names the 4 ACs that wait for 034.b; ITEM-056's row names the accepted "Not verified" items.
3. File the two 2.1.323 regressions as new items with status **Done** (2026-11-13), type Bug, citing their records; the validate one notes "Node 22 run in CI pending".
4. File the follow-ups as new **Backlog** items (P3 unless you see a reason), each citing its source record:
   - `markTranscriptRead` helper in cache-state.ts (17.4.l1.2.1, S1);
   - resolve-hook: why-comment on the empty catch, and a `.tsx` fallback test (63.4.1 S1, S4);
   - a test pinning two engine nodes in `inlineBeneath` (42.4.l2.1.1);
   - a test keeping the root and plugin lens notice sections identical; fix the overstated sentence at `THIRD_PARTY_NOTICES.md:1238` (20.5.l1.2 Minors);
   - spec AC stating the band order (42.4.l2.1.2 S1);
   - agent-artifact: nested spawns of teammates report to the lead, and research-assistant teammates have no web tools (run state *Housekeeping*);
   - the herdr pane-layout follow-up is already filed in `docs/handoffs/AAWP-20261112-herdr-skill/run.v2.md` — reference it, do not duplicate.
5. Do not commit. Report compressed: `path:line — old → new` per row and the new item numbers. Next hop: devops-engineer commits, then the G4 record.

## Suggested skills
- `ai-dlc:product-planning`, `ai-dlc:task-triage`.
