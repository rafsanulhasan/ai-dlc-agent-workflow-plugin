# Step 44: live findings 3 (the human, 2026-10-31)

Taken after `/reload-plugins` on round 44.2.l1.4 (phase B plus R44.11 to R44.13), in VS Code. The human: "i think its okay except for one thing." So R44.7 to R44.13 pass live, apart from the points below.

## Verbatim

> i think its okay except for one thing. when the panel type is drill in, don't need to show the run list in a separate tab. but when the panel type is tab mode show both runlist (inactive) and the current run (active) with the current step expanded, as the current behaviour.
> means the current behavior of showing run list in active mode in a separate during widning is only applicable for tab mode, not drill mode.
>
> also when widened and shown in the right panel, it should be automatically swich to docked mode instead of pinned mode.
> also when narrowed and shown in the band, it should be automatically swich to pinned mode instead of docked mode.
>
> clicking on the mode would switch between docked (panel) and pinned (band) mode

## Requirements (binding; the exact meaning of "panel type", "tab mode", "drill in", "pinned" and "docked" is taken from the lens's existing settings and controls, and agent-manager confirms each against the code)

- **R44.14:** on widening, the lens opens the Run List as a separate tab only when its panel type is **tab** mode. Then it shows the Run List (inactive) and the current run (active, with its current step expanded), as now. In **drill-in** mode it opens no separate Run List tab. Narrows R44.12.
- **R44.15:** when the lens is widened and shown in the right panel, its mode switches to **docked** by itself. When it is narrowed and shown in the band, its mode switches to **pinned** by itself. This replaces the lens showing "pinned" while it sits in the right panel.
- **R44.16:** clicking the mode control switches between **docked** (the right panel) and **pinned** (the band).

## The human's answers to am-44's plan (2026-10-31; plan: 44.2.l1.5-agent-manager-to-orchestrator.plan.handback.md)

- **R44.16: option (a).** Pinned means the lens is drawn in the AbovePrompt band above the prompt, and its pane closes. Docked means the lens pane: the right panel when the panel is wide, above the prompt when it is narrow, as the host decides. R44.4 is relaxed for this case only: the lens band is allowed in VS Code while the person chose pinned and the lens pane is closed, so the two lens views never show at once. In a narrow panel, docked still sits above the prompt.
- **R44.14 extended:** the same rule applies to `/ai-dlc:lens` in an already-wide panel. In drill-in mode it opens the workflow tab only. In tab mode it opens the Run List (inactive) and the workflow tab (active), as now.
- R44.15 as planned: the mode follows the seat (dock → docked, inline → pinned), after the render and once per change. In VS Code the pinned note "this surface has no band above the prompt" is dropped.
