---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — post-release backlog
lifecycle: Release (segment of AI-DLC)
step: 76
from: product-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-11-13
---

handoff 76-orchestrator-to-product-manager.handoff.md: passed — brief read, release facts matched the checklist and records; only `docs/backlog/backlog.md` edited, nothing committed.

Status finding: nearly every shipped item was already Done in its row (030-036, 045-047, 050, 052, 053.a, 056, 058, 068-074, 076, 077, 092-097, 107, 001, 108, 109, 112). So no status flips were needed for them. The plan-table rows have no date column, and editing the very long rows was fragile. I recorded the release date and the shipped list in a new release section instead.

**Changes (`docs/backlog/backlog.md`):**
- ITEM-112 (line 291): Done → Done. Milestone `Unplanned` → `1.0.0-preview1`, and the Done line now says it was released in v1.0.0-preview1 on 2026-11-13.
- ITEM-113 (line 305): Done → **In Progress**. Milestone `Unplanned` → `1.0.0-preview1`. Fix fix shipped, but the item stays open until the Node 22 AC passes.
  - Line 317: `- [x] Node 22 run in CI passes (pending, human checks before G4)` is now `- [ ] Node 22 run in CI passes (pending: CI is locked over billing; local checks ran on Node 24.11.1)`.
  - The body now says no Node 22 run has happened and that it closes on a CI run after the billing fix or a local Node 22 run.
- New section `## Release v1.0.0-preview1 — 2026-11-13` (line 405, at the end of the file):
  - It gives the release facts: PR #26, `9eae890`, tag, prerelease URL, versions, and links to the checklist, records 70 and 75, and `CHANGELOG.md`.
  - It lists what shipped Done on 2026-11-13: 001, 108, 109, the tier-1 plan rows, the step-44 items 092-097 and 107, and 112.
  - It lists what shipped but is not Done, each with what remains:
    - ITEM-113 (Node 22 run pending).
    - ITEM-098 (live checks M25-M31, M34, P17-P26, A1 and A2, plus the live two-plugin band check on 2.1.323, P9-P11 / O15).
    - ITEM-104 (M35 not run).
    - ITEM-056 (Done as accepted at G4, with the "Not verified" notice items still unverified).
    - Keep-alive `MANUAL-CHECKS.md` P1, P2 result cells still empty.
  - It lists the carried and not-planned items and the follow-ups, unchanged.

**Open for you:** ITEM-075 is inconsistent inside the backlog. Row 137 (ITEM-056's text) says "ITEM-075 DONE 2026-11-13", but the ITEM-075 row (line 158) still says Backlog, sprint 2. I did not change it, and the new release section lists 075 as carried. Please check which is right.

**`git diff --stat docs/backlog/backlog.md`:**
```
 docs/backlog/backlog.md | 33 +++++++++++++++++++++++++++------
 1 file changed, 27 insertions(+), 6 deletions(-)
```

Next hop: orchestrator → devops-engineer (commit). File: E:\Projects\personal\ai-dlc-agent-workflow-plugin\docs\backlog\backlog.md
