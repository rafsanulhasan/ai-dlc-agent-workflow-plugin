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
7. **R44.23 amended (2026-11-01), after 44.2.l1.11:** in a terminal or Desktop session with the VS Code panel attached, while pinned, the terminal (or Desktop) keeps its lens band AND the attached VS Code panel also gets the lens pane (pane plus band; the earlier behaviour for that panel). The attached VS Code panel must never be left with no lens view while pinned. (Was, as built in 44.2.l1.11: VS Code client shows nothing while pinned, only via the chat card or docked.)
8. **R44.23 mode button ratified (2026-11-01):** the lens mode button acts by the surface it was pressed on: pressed in an attached VS Code panel, it moves the lens between VS Code's pane and VS Code's band (that panel always keeps a lens view); pressed in the terminal or Desktop, it switches the session between pinned and docked. (Agent-manager's choice in 44.2.l1.12, now the human's decision.)
9. **Q44-C, the seat follow (2026-11-01): only VS Code renders drive the seat memory.** `lastSeat`/`paneSeat` and the seat follow (`followSeat`, `seatChanged`) react only to lens pane renders whose own surface is `vscode`; terminal and Desktop renders of the shared pane never change the place or close tabs.
10. **Q44-D, manual closes (2026-11-01): allowed exceptions.** Decision 7's "never left with no lens view" covers the lens's own acts only. When the person closes the pane by hand (Escape, close) or the band with its ×, or the host leaves the pane undrawn (`isPlaced: false`), the attached VS Code panel may show no lens view until the person reopens it; the lens reopens nothing the person closed.
11. **Decision 10 narrowed (2026-11-01), after 44.3.l1.6:** a lens band closed with × still comes back at the next agent spawn, at `/ai-dlc:lens`, or in a new session (step 36's Amendment 8: `agent.spawn` resets `bandClosed`). Decision 10's "the lens reopens nothing the person closed" covers every other act of the lens (timers, turn ends, renders, the pane's seat follow); the next spawn, the command and a new session are the stated exceptions for the band. A pane closed by hand is not reopened by a spawn.
12. **The person's own press wins (2026-11-01), after 44.5.l3.7:** a band closed with × also comes back when the person presses a control that asks for the band: the mode button pressed in VS Code (its VS Code path, `placePress`, register.tsx:1348) and the pane's ↺ (`paneToBand`, :1633). Decision 10 covers only the lens's own acts; any press of the person that asks for the band shows it, even after ×.
