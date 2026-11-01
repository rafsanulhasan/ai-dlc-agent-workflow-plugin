---
step: 49
from: human
to: orchestrator
run: FEAT-20261020-ai-dlc-lens
date: 2026-11-01
---

Human's answers (AskUserQuestion, 2026-11-01), after research 44.1.l2.1 and documentation-writer 44.5.l3.10:

- **Halted-state bug (follow-up to step 44):** fix now from the research, without reproducing first. agent-manager makes the narrow fix (a subagent's non-answer turn.complete keeps it running unless the engine's agent list also says it ended; a listed running clears a stale failed / killed that came from turn.complete); sqa-engineer adds the tests, a background spawn included; then code review. A live check with the lens probes on becomes a manual check, result "not run" until the human runs it.
- **Decision 15 (scope of decision 13):** keep as built. A mode-button press that comes from a VS Code panel always takes the VS Code path, whatever the session's own surface (register.tsx:1333, AC-12.29 (a)); the session's own surface decides every other press (decision 13). No code change; documentation-writer writes the exception in.
