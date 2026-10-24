---
run: FEAT-20261020-ai-dlc-lens
step: 32
from: orchestrator
to: human
kind: handoff (gate G3, tier 1 task plan)
date: 2026-10-24
run-state: run.v3.md
---

# G3: tier 1 task plan and sprint 1 cut

## Artifact
`docs/plans/tier-1-sprint-1.tasks.md` (pm). It holds merge groups KA, WF, HS, RUN and LENS; the WF-1 atomic unit (045 + 050 + 046 + 047); ~35 tasks with ACs and test seams from the LLDs; waves; critical paths; the sprint cut; root 33 (ITEM-067, 067.a) in tier 3; traceability; and the docs updates.

## Gate evidence
- bc: round 1 REVISE (`30.2.l1.1-…`); round 2 PASS (`30.2.l1.2-…`); a post-G2 addendum (`30.2.l1.3-…`): no "per G2" leftovers.
- G2 decisions applied (afterFence; renderers ≤ 15 MB; --artefacts; taxonomy.json owned by PM; 034.a thresholds).
- In flight, not blocking G3: the root 20 spec/LLD are being amended to afterFence only; ra updates the root 18 stories for --artefacts (with a bc check).

## Questions for the human
1. **Sprint 1 cut** (ends 2026-10-27):
   - Commit: chain A (030, 031, 032, 033, 035; 10 sessions) plus WF-1 (8 sessions).
   - Stretch: 034.c, 034, 048, 034.a, 036, 053.a.
   - Carry over: the root 18 build, 049, 051, 053.b onward, 034.b.
2. **Capacity guess:** S = 1, M = 2, L = 3 sessions; about 4 sessions a day per chain; 3 days.
3. **034.c** needs you watching once, after 033 merges; otherwise 034 and the rest of KA carry over.
