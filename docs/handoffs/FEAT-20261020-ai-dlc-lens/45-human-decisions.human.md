---
run: FEAT-20261020-ai-dlc-lens
step: 45 (G4 for step 44)
date: 2026-10-31
by: human
---

# G4, step 44: the human's decisions (2026-10-31)

Asked at gate record 45-orchestrator-to-human.handoff.md. G4 is NOT approved yet: a fix round runs first.

1. **AC-12.12 / R44.4 (R44.21): gate the lens band on the session's own surface.** A terminal session keeps its lens band even when VS Code is also attached, and with an unknown roster; only a session whose own surface is VS Code follows the VS Code rules. (Was: the whole attached-surface roster, register.tsx:1282, :4536.)
2. **AC-7.13 (R44.22): extend the code.** Step chart headings (stepLook) use the same run-status rule as the run list (runListStatus), so a finished step of an active run never reads "completed", and an unknown run status does not read completed either.
3. **MANUAL-CHECKS M25 to M31 (lens) and P17 to P26 (keep-alive): keep them pending**, to be addressed later. Do not mark them now.
4. **Review warnings: fix now, in one round** (stale comments, the statusText test fixture, tests for AC-17.8.3, AC-17.8.6, AC-17.8.9, the AC-1.6 wording), then one re-review round.

## Follow-up decisions (2026-11-01), after 44.5.l3.2
5. **R44.22 extended:** a run with no readable run state never reads completed in its step charts either; they read waiting, like the run list (was: stepLook passes [] and keeps the agents' verdict).
6. **R44.23: `/ai-dlc:lens` and the pinned/docked switch follow the session's own surface too.** In a terminal (or Desktop) session the command draws the band and opens no pane, whatever else is attached (was: the every-attached-surface rule, so a terminal with VS Code attached got a pane plus the band).
