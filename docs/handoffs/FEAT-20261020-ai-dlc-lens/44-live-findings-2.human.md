# Step 44: live findings 2 (the human, 2026-10-31)

Taken after `/reload-plugins` on the step 44 working tree (code review 2/2 APPROVE, docs critique PASS), in VS Code. `/ai-dlc:lens` replied "AI-DLC Lens brought forward."

## Verbatim

> no extra panes for cache-keepalive.
> in both narrow and wide claude panes in vscode, cache-keepalive will just be shown in the band.
> when both opened (lens+keepalive) inside tabs in the band in narrow pane, and the user resizes the pane, both tabs go away from the band and the band in hidden. this should not be the case.
> the the user increases the size of the claude pane in vs code, which makes a narrow pane wide, the keepalive tab should still be in the band. and the tab for ai-dlc:lens in the band gets closed and be opened in the right pane.
>
> in the same way, when both opened (lens in the right pane+keepalive in the band) in wide pane, and the user decreases the width of the pane, right pane gets closed and the band gets an added tab for the lens.

## Requirements (binding; "the band" is the human's word for the tabbed view above the prompt, "the right pane" the docked pane)

- **R44.7:** keep-alive opens no pane of its own beyond the band. In VS Code, narrow or wide, keep-alive is shown only in the band, as its tab.
- **R44.8 (bug):** with keep-alive and the lens both open as tabs in the band in a narrow panel, resizing the panel must not remove both tabs or hide the band.
- **R44.9 (narrow → wide):** when the panel grows from narrow to wide, keep-alive's tab stays in the band. The lens tab leaves the band, and the lens opens in the right pane.
- **R44.10 (wide → narrow):** with the lens in the right pane and keep-alive in the band, when the panel shrinks from wide to narrow, the right pane closes and the band gets a lens tab again.

## The human's answers after am-44's research (2026-10-31; research: 44.2.l1.2-agent-manager-to-orchestrator.handback.md)

Verbatim:
> R44.7: "Make keepalive a separate band to make the given requirement possible"
> R44.9/R44.10: "since they are two separate bands now, it won't be a problem to implement the resize requirement on the lens (band vs right panel) only. not on the keepalive band."
> R44.8: probe first.

Requirements as revised (binding):
- **R44.7 (revised):** in VS Code, keep-alive is its own band above the prompt (the `AbovePrompt` site), separate from the pane region, in narrow and wide panels alike. It opens no pane. This reverses, for keep-alive only, R44.4's "no band below the pane" (step 44, second clarification). The lens keeps that rule: it shows no band of its own in VS Code.
- **R44.9 and R44.10 (revised):** only the lens moves with the panel width: inline above the prompt when narrow, in the right (docked) pane when wide, and back. Keep-alive's band is not affected by a resize.
- **R44.8:** probe first (a log only, no behaviour change). The human resizes once each way, then the fix is built on the confirmed cause.
- Evidence to reconcile: research fact F3 says `AbovePrompt` is raised on the terminal and desktop only (d.ts 10818). But step 44's original bug 1b/2a showed keep-alive's `AbovePrompt` band drawn in VS Code (am-44's own R44.4 cause, 44.2.l1.1). The probe must log whether, and with which surface id, `AbovePrompt` renders in VS Code.

## The human's answers to the 44.1 open questions (2026-10-31)

Asked after product-owner, product-manager, software-architect and system-engineer revised their artifacts (44.1 hand-backs).
- **R44.11:** retire `statusText` now. Remove it, and its variable `AI_DLC_KEEPALIVE_STATUS_TEXT`, from the schema, the settings, the merge and the CLI. A settings file that still sets it must not break: it is reported as no longer used and dropped on merge. It does not fail validation.
- **R44.12:** when the panel widens and the lens docks, the lens opens its Run List tab itself once the panel is wide enough, accepting that the host may keep it undrawn under its floor (110 or 144 columns). Replaces "narrow to wide does not open it".
- **R44.13:** the automatic-handoff exception for keep-alive (`applyHandoffSeed`) uses the head row's rule (either track on in force, `anyOn()`), not the master switch.
- **Priority P1** confirmed for step 44. The Cache Lab keep-alive row stays as it is.
