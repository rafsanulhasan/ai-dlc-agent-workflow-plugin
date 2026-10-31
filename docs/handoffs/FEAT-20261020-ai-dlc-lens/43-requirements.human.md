# Step 43 requirements (human, 2026-10-26, verbatim intent, run.v4.md 2cq)

A. Commands open bands minimised:
 1. /ai-dlc:lens shows only the band, minimised; the right panel is opened from the band with the full-screen button.
 2. /ai-dlc:cache-keepalive shows only the band, minimised; the right panel is opened from the band with the full-screen or maximise button.

B. Pinned mode, lens band and panel (the previous rule is not working):
 1. Minimise: a. from the band minimises only the band, not the right panel. b. from the panel minimises only the band, not the right panel.
 2. Maximise (responsive): a. band: i. narrow Claude Code panel: expand the band to the run list; clicking an item opens the flow in the band. ii. wide: expand the band to the run list; clicking an item opens the flow in the panel; the band stays on the list. b. from the panel: the band never goes to workflow view, list mode only.
 3. Full screen: a. from the band: i. band minimised or in list mode -> open the right panel at once, in list mode. ii. (as i). iii. band in workflow mode -> open the right panel at once, in workflow mode. b. from the panel: not applicable (already full screen).
 4. Restore: a. from the band: i. workflow mode -> back to the list view. ii. otherwise not applicable. b. from the panel, band closed: i. workflow mode -> close the panel, show the band in workflow mode. ii. list mode -> close the panel, show the band in list mode. c. from the panel, band open: keep as it is now.
 5. Clicking an agent avatar follows the same rules. 6. Clicking an arrow follows the same rules. (Ask the human when unsure.)

C. Bugs:
 1. The last run is completed but still shows halted; its sub-accordion says pending. a. A step halted and then started again must show the latest status. b. A halted run continued in a new Claude Code session: both sessions must show the new status; today the old session's is not updated.
 2. Workflow mode layout order: Panel Type; separator; Anomalies; separator; back button; status; run name and metadata; each step in its own accordion; each step accordion gets a minimise button just left of its full-screen button.
 3. Agent panel: a. Cache Lab collapsed by default like the other sections. b. Order: Panel Type; separator; back button; agent name, model and role (look unchanged); separator; Anomalies; separator; Context Lab; separator; Cache Lab; the rest, each with a separator.

Process: research first; then an agent team in which the engineering lead (agent-manager: plugin code is agent-artifact work here) spawns parallel subagents per plugin, and the SQA lead spawns parallel SQA subagents.

## Human's answers (2026-10-26, after research 43.1.1-43.1.3)
- B3 full screen from the band, corrected: i. band minimised or in list mode -> open the right panel at once, in list mode. ii. band in workflow mode -> open the right panel at once, in workflow mode. (The earlier iii is redundant.)
- The panel's mode depends on how it was opened: 1. from the band: the B rules. 2. by the command: if any run is active / in progress, open the active workflow view (several: the latest); none: open the run list. 3. from the agent card in the chat: open that specific step in workflow mode.
  (Lead's reading: in pinned mode /ai-dlc:lens shows the band minimised (A1) and does not open the panel; rule 2 applies wherever the command opens the panel itself: docked mode, or a surface with no band. Flag to the human if the build finds another case.)
- B4b "band closed" means either: dismissed with × or not on screen at all.
- B5/B6 avatar and arrow clicks follow the band width: from the band, narrow -> opens inside the band, wide -> opens in the right panel; from the panel -> opens in the panel; Panel Type (Drill in / Tab) still decides drill-in vs a separate tab.
- Agent panel order (C3b) adds a Panel Type switch and Anomalies to the agent panel (it has neither today).
- Research: B needs a per-site (band, panel) list/workflow mode in the lens view state, a list-only panel view, a mode-aware restore, and avatar/arrow routing into the view (43.1.1). Status bugs: sticky failed/killed agents halt the workflow; pending placeholders and no-hand-back records beat completed; the 2 s poll never refreshes run state, so other sessions go stale; band and step accordion use different run-status inputs (43.1.2). Layout facts and pinning tests: 43.1.3.
