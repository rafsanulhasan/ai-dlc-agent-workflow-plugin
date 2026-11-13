# Step 44: findings 5 (the human, 2026-10-31)

Raised by the requirement-analyst (44.1.l1.1, open question 1), confirmed by the orchestrator in the code (lens `register.tsx:1529`): in Drill-in mode, when the panel widens after `/ai-dlc:lens` left the lens in its narrow minimised list, `seatChanged` returns before laying out the workflow view, so the docked pane can keep the minimised list instead of the flowchart.

## Verbatim (the human's answers)

> yes show the flowchart in right panel only. not in the band. if it is narrow, we have two choices:
> 1. widen the claude vscode panel automatically and then show the flowchart in the right panel
> 2. disable then full-screen button in pinned mode when the panel is narrow.

On the analyst's extras, the human chose only: "Fix stale ACs" (AC-17.6.3, 6.21 and AC-17.7.1 still cite the `/ai-dlc:cache-keepalive 2h --track ... --session` grammar that moved to `/ai-dlc:cache-keepalive-configure` in step 43). Not chosen: an AC for `on|off --session`, and [MV] ACs for R44.11 and R44.13.

## Requirements (binding)

- **R44.19:** on widening (the lens docks), the lens lays out the workflow view with its flowchart in the right panel in **both** panel types. Only Tab mode adds the Run List tab (R44.14 stands).
- **R44.20:** the flowchart is shown in the right panel only, never in the band. When the panel is narrow, one of the human's two choices applies, in this order:
  1. if the host lets a plugin widen the Claude panel in VS Code, the lens widens it and then shows the flowchart in the right panel;
  2. otherwise, in pinned mode while the panel is narrow, the full-screen control is disabled (so the flowchart is not opened in the band).
  agent-manager finds which one the host allows, with evidence, before building.
- **Docs:** the requirement-analyst rewords AC-17.6.3, 6.21 and AC-17.7.1 to the configure grammar.

## The human's answers after the build (2026-10-31, round 44.2.l1.7)

Verbatim:
> Should the band show no flowchart at all in VS Code, as Boris built it, or only not in full screen, as the requirement-analyst read it? keep it as boris built it.
> Should the terminal follow the same rule? no since the terminal does not have other windows like vscode does. so in terminal it is ALWAYS shown in the right panel .

- **R44.20 (final):** agent-manager found that a plugin cannot widen the VS Code Claude panel (44.2.l1.7), so choice 2 applies. In VS Code, step flowcharts are drawn only in the docked right pane. Above the prompt (the inline pane, or the band chosen with the mode button) an open step shows "Widen the Claude panel to see the flowchart in the right panel." instead of the chart, and its full-screen control is dim and not pressable while the panel is narrow. On a band in a wide panel, the step's `⤢` opens the right pane on that step.
- **Terminal and Desktop:** unchanged. The rule above is VS Code only. In the terminal, flowcharts keep being shown as before.
