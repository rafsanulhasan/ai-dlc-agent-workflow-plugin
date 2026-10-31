# Step 43 live findings, round 1 (human, 2026-10-26, VS Code, after /reload-plugins; run.v4.md 2dc)

Note for the team: in VS Code there is no AbovePrompt band (research 42.1); what the human calls "the band" there is the inline Pane above the prompt, and "side panel" is the docked pane beside the chat when the Claude extension panel is wide.

1. /ai-dlc:cache-keepalive
 a. Wide Claude extension panel: no side panel (Pane) of its own; band only.
 b. Narrow: it opens in the band (as a new tab), which is fine, but it must open MINIMISED; it has no minimise/maximise button at all there — add them.
 c. Text left-aligned (fine); buttons RIGHT-aligned; all buttons the same height.
2. /ai-dlc:lens
 a. Narrow: today it opens workflow mode, maximised. Expected: the run list, minimised, in the band, showing the in-progress items.
 b. Wide: today it opens workflow mode, maximised. Expected:
    i. the band minimised, showing the run list in this order of precedence: in progress, then halted, then pending;
    ii. the side panel: the run list is available but not the active view; the WORKFLOW view is active, on the latest run; one accordion per step of the run, all collapsed by default, except the most recent step (or the step reached from an agent card in the chat), which is expanded; each step accordion has a full-screen/restore button and a minimise/maximise button.
    (Lead's reading of "Run List Opened but not active": the panel opens in workflow mode on the latest run, with the run list one step back ("< Runs"); confirm in the hand-back if the code offers both as tabs.)
 c. The numbered steps list must go entirely (and its numbers are duplicated today).
 d. A large flowchart in a step gets blank space at its top or bottom. Centring is fine; the blank space is not: no empty padding/margin around the chart.
3. Agent (avatar) panel: Cache Lab is still expanded when the panel loads; it must start collapsed (whatever this session or an earlier one left in the store).

## Human's answers to am-43's questions (2026-10-26)
- 1a (wide VS Code, no band possible): /ai-dlc:cache-keepalive shows only its band/pane, MINIMISED, containing the master switch and the status only.
- 2b.i (wide): yes, keep it as it is now (the side panel's top row is the minimised line, the workflow view below), but in minimised state; minimised, it lists the TOP 3 runs of the run list (in progress first), as it did before, not one.
- Order: in progress, then waiting, then halted, then pending, then completed.
- Clarified (human): the precedence order (in progress, waiting, halted, pending, completed) applies ONLY in the minimised state; the full run list keeps its normal order.
- CORRECTION (human, 2026-10-26) to 2b in a wide panel: /ai-dlc:lens opens TWO docked (tabbed) panes: (1) a Run List pane, opened but NOT the active tab, minimised, showing the top 3 runs by precedence (in progress, waiting, halted, pending, completed); (2) a Workflow pane, the ACTIVE tab, on the latest run, with step accordions collapsed except the newest (or the agent card's) step. Not one pane with a top row. Keep-alive in a wide panel: its pane opens minimised, master switch and status only (confirmed).
- ADDITION (human, 2026-10-26): "and also the band". Lead's reading for a wide panel: /ai-dlc:lens shows THREE things: (a) the band (inline above the prompt), MINIMISED, with the top 3 runs by precedence; (b) a docked Run List tab, opened but not active, the full list in its normal order (precedence applies only when minimised); (c) a docked Workflow tab, active, on the latest run. If VS Code cannot seat an inline band while the panel is wide, report it with the d.ts line.
