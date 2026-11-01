---
step: 57
from: human
to: orchestrator
run: FEAT-20261020-ai-dlc-lens
date: 2026-11-02
---

Human's answers (AskUserQuestion, 2026-11-02), after research 44.1.l2.7 (why step 44 reads halted after G4):

- **Decision 25:** "Done step settles it". Once a step's stage is done, a failed or killed agent in it no longer halts the step: `settleMembers` (hooks/lens.ts) settles failed / killed members of a done stage as it already settles pending and open ones. The pinned test (lens-status-43.test.tsx, "a failed member with no retry is not settled by a done stage") is changed to the new rule. A code change: agent-manager builds, sqa-engineer tests, then a code review (new loop, 2 rounds / 1 failure from `rounds --json`), then the human.
- **Decision 2 kept:** a step reads completed only when its run is done; until then a settled step reads waiting.
