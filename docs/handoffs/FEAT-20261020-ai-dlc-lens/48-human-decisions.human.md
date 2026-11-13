---
step: 48
from: human
to: orchestrator
run: FEAT-20261020-ai-dlc-lens
gate: G4 (step 44, fourth presentation)
date: 2026-11-01
---

Human's answers to 48-orchestrator-to-human.handoff.md (AskUserQuestion, 2026-11-01):

- **Decision 13 (narrows decision 8):** the session's own surface decides what the mode button does, not the surface the press came from. In a session whose own surface is VS Code, a press on the terminal band takes the VS Code path (as register.tsx:1333 and AC-12.29 (c) already do). Docs only: decision 8's wording is narrowed wherever it is stated. No code change.
- **Decision 14 (mobile rules):** the mobile rules AC-12.28 (d) and AC-12.29 (f) belong to a separate mobile epic, not worked on in this sprint. The code and its three tests stay as they are; the two ACs move out of the step-44 stories into the new epic in the backlog, and the docs say they belong to that epic.
- **G4:** approved once the docs edits for decisions 13 and 14 are made and verified. Mutant N6 (W2), the 11 suggestions of round 4 and the repository test tests/stop-sync-then-check.test.mjs:149 (0.3 s timeout) become follow-up backlog items.
