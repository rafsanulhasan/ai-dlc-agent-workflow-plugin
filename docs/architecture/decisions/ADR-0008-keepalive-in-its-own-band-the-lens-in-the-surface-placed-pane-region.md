# ADR-0008: Keep-alive draws in its own band above the prompt, and the lens lives in the pane region the surface places

**Date**: 2026-10-31
**Status**: Accepted (the human, 2026-10-31, step 44; amended the same day for R44.11, R44.12 and R44.14 to R44.20; the human's live check of every build round passed on 2026-10-31 in VS Code; M33's terminal part not yet checked; tests done; critique and code review pending)
**Deciders**: the human (step 44: R44.1, R44.4, R44.7 revised, R44.9 and R44.10 revised, R44.11, R44.12, R44.14 to R44.20, in `docs/handoffs/FEAT-20261020-ai-dlc-lens/44-live-findings.human.md`, `44-live-findings-2.human.md`, `44-live-findings-3.human.md` (option (a) for R44.16), `44-live-findings-4.human.md` and `44-live-findings-5.human.md` (R44.19, R44.20, with the human's answers after the build)); agent-manager (host research 44.2.l1.2, facts F1 to F6, and the probe of 44.2.l1.3, run.v4.3.md entry 2ff); software-architect (this record)

## Context

Two modules draw above the prompt: keep-alive (ai-dlc plugin, `hooks/keepalive/`, its band drawn from `hooks/auto-handoff/register.tsx`) and the lens (ai-dlc-lens plugin). Until step 44, keep-alive had three places for its state: a status line (spec D13, a short summary), an `AbovePrompt` band on the terminal and Desktop, and a Pane on VS Code (spec D9). The Pane existed because the types say the band is raised on the terminal and Desktop only (`claude-code.d.ts` 2.1.310, :10818).

Two host facts decide where each module can sit:

- **The surface places the panes, all of them together.** Every pane of every module is a tab of one framed region ("one shown, the rest tabs", d.ts :10867-10868). A module cannot choose where a pane sits: `placement` is read-only (:10897-10903) and `PaneOpenArgs` has no placement (:7589-7660). VS Code moves the whole region by the panel width: inline above the prompt when narrow, docked on the right when wide, at about 70 columns (probe, 2ff: `isFullscreen` flips). There is no resize event (:4098), a module cannot open or close a pane while drawing (:3494), and a pane opened later by a timer is "unasked" and may wait undrawn below 110 or 144 columns (:15067-15074).
- **`AbovePrompt` does render in VS Code.** The probe logged 76 renders with surface `vscode` (2ff), against the d.ts line :10818.

So while keep-alive was a pane, it docked with the lens whenever the panel grew. The human saw both tabs leave the area above the prompt and the band hide (R44.8; cause confirmed by the probe: nothing closed, the region docked). The human wants keep-alive to stay above the prompt at every width, and only the lens to move (R44.7, R44.9, R44.10). With keep-alive's band on every surface, the status-line summary only repeated it (R44.1).

Later the same day the human widened the lens's part. In Tab mode the lens brings its Run List tab when it docks (R44.12, R44.14). Its mode word follows its seat (R44.15). Its mode button moves it between the right pane and the band above the prompt (R44.16). The live check of that round then showed a host error, `state.set: denied … while the ui.render is being dispatched`, and a missing step chart (R44.17, R44.18). The cause: a `$.clock.after(0)` timer only moves a write past the render that asked for it. Renders here are frequent (each step of a resize, the lens's 500 ms blink, its 2 s poll), so the timer could fire inside a later render, and the host refused the write (d.ts :3494).

A last round (R44.19, R44.20) settled where the step flowchart goes. In Drill in mode, widening could leave the docked pane on the minimised list with no flowchart. The human asked for the flowchart in the right panel only, never in the band above the prompt. If the host lets a plugin widen the Claude panel, the lens should widen it; if not, the full-screen control should be off while the panel is narrow. A plugin cannot widen it (44.2.l1.7): no `$.ui` operation sizes a surface (d.ts 2382-2640), and `PaneOpenArgs.columns` only sizes the dock (7646-7657). After the build the human kept the rule as built: no flowchart above the prompt at all in VS Code, and the terminal and Desktop unchanged, since the terminal has no other windows to widen.

## Decision

We will draw keep-alive only in its own `AbovePrompt` band, on every surface (VS Code included), with no pane and no status line, and we will keep the lens in the pane region, letting the surface decide where it sits and adapting the lens to that seat.

- **Keep-alive.**
  - One band (title row with the master Button, the 5m and 1h rows, the seed row while a track is on), at every panel width. It is outside the pane region, so a resize does not move it.
  - No keep-alive Pane: `/ai-dlc:cache-keepalive` opens none.
  - No status line: keep-alive writes nothing to `ui.status`. The published `$.state` lines are unchanged, so the lens and other readers keep the full text.
- **The lens.**
  - By default no band of its own in VS Code (R44.4). It is a pane, and the surface seats it: inline above the prompt when narrow, docked on the right when wide.
  - **Pinned and docked in VS Code (R44.16, the human's option (a)).** Docked means the lens pane, wherever the surface seats it. Pinned means the lens drawn in the `AbovePrompt` band, with its pane and its Run List tab closed. The mode button switches between the two. Pressed in the pane, it closes the pane and the Run List tab and draws the band, minimised. Pressed on the band, it opens the pane the way `/ai-dlc:lens` does; a press is the person's, so the host places the pane at any width. R44.4 is relaxed for this case only: the band is allowed in VS Code while the person chose pinned (the session value `vscodeBand`) and the lens pane is closed. Drawing any lens pane clears that choice, so the two lens views are never up together for more than one frame. In a narrow panel the pane sits above the prompt too, so there the button switches between two views that are both above the prompt. On the terminal and Desktop the button keeps its old toggle.
  - **The mode follows the seat (R44.15).** In VS Code each change of seat sets the mode: `docked` when the pane is drawn in the right pane, `pinned` when it is drawn inline above the prompt. The `workflowPlace` setting is not changed. VS Code no longer shows the note "this surface has no band above the prompt".
  - It reads `placement` on each Pane render and adapts after the render, never during it. Going to inline, it closes its wide-only Run List tab, so the narrow view keeps one lens tab (R44.10). Going to dock after being inline (R44.12, R44.14, R44.19): in both panel types it lays the panel out as `/ai-dlc:lens` does in a wide panel, with the workflow tab active on the newest run and its current step open, so the step's flowchart is drawn in the right pane. Only when Panel Type is **Tab** does it also open the Run List tab, without focus; in **Drill in** it opens no Run List tab. `/ai-dlc:lens` in a wide panel follows the same rule: Tab opens the Run List tab (inactive) and the workflow tab (active); Drill in opens the workflow tab alone and closes an open Run List tab. The plugin makes the open on docking, not the person. So the host places the Run List tab only from 144 columns, or from 110 once the person has opened it and not closed it by hand; below that it stays open but undrawn until the panel widens or the person opens it (d.ts :15066-15074). The human accepted this (R44.12).
  - **Writes a render asks for (R44.17, R44.18).** Every state write the lens makes because of a render (the seat follow, the band giving way to a pane, the band ping) runs through one helper, `afterRender`. It waits a 0 ms timer after the render. When the host refuses the write as made during a render dispatch, it runs the whole act again 100 ms later, up to 20 tries. Any other error, and the last refusal, show as a lens error, and every act given to it must be safe to repeat. This also fixes R44.18: when the seat follow's first write was refused, the act stopped before it laid out the workflow view, so the docked pane kept the minimised list and drew no step chart.
  - **Flowcharts in the right pane only, in VS Code (R44.20, choice 2).** A plugin cannot widen the Claude panel (44.2.l1.7), so the lens draws a step's flowchart, at normal size or in full screen, only in a lens pane seated `dock`. Above the prompt (a pane seated `inline`, or the band chosen with the mode button) an open step shows the dim line "Widen the Claude panel to see the flowchart in the right panel." in place of the chart (`chartOff`). While the panel is narrow its `⤢` is dim text, not a Button, so it does nothing (`fullOff`); the host's Button has no disabled flag (d.ts 1093-1198). On the band in a wide panel (the band's viewport reports `isFullscreen`, `ViewSite.wide`) the band still shows no chart, but `⤢` opens the right pane on that step. Terminal and Desktop are unchanged: their band and panes keep drawing flowcharts.
  - On the terminal and Desktop its existing band rules stay.
- **Rule for later modules.** A view that must stay above the prompt at every width is an `AbovePrompt` band, not a pane. A pane goes where the surface puts the region, and its module adapts to `placement`; it never tries to move itself. A write that a render triggers is never made in the render, and one timer is not enough to leave the render: the module retries a write the host refuses as made during a render dispatch, and keeps each such act safe to repeat.

## Alternatives Considered

- **Keep-alive stays a tab of the shared pane, beside the lens** (research option (a)). Rejected by the human: it docks with the lens when the panel is wide, which is the R44.8 behaviour.
- **Keep-alive's rows live only inside the lens view** (research option (b)). Rejected: there would be no keep-alive view while the lens is closed, and the two plugins would be coupled for a keep-alive control.
- **The lens re-seats itself on resize** (close and reopen to force inline or dock). Rejected: the host gives no placement argument, no resize event, and no state writes while drawing, and a reopen from a timer is unasked and may stay undrawn (F1, F4 to F6).
- **Keep the status-line summary as a second view.** Rejected by the human (R44.1): it repeats the band, which now draws on every surface.
- **The mode button works only in a wide panel** (agent-manager's R44.16 option (b), 44.2.l1.5 plan). Not chosen: the human chose option (a). In a narrow panel the button would do nothing but say to widen the panel.
- **The mode button changes only its label** (R44.16 option (c)). Not recommended and not chosen: in VS Code pinned and docked would stay the same pane, which is why the lens read `pinned` while it sat in the right pane.
- **A bare `$.clock.after(0)` for render-triggered writes** (round 44.2.l1.5). Rejected after the live check (R44.17): the timer can fire inside a later render, and the host refuses the write.
- **The lens widens the Claude panel, then shows the flowchart in the right pane** (R44.20 choice 1, the human's first preference). Not possible: no host operation sizes the panel (d.ts 2382-2640; `PaneOpenArgs.columns`, 7646-7657, only sizes the dock), so choice 2 was built.
- **Block only full screen above the prompt, and keep the normal-size chart there** (the requirement-analyst's reading). Not chosen: the human kept the build, with no flowchart above the prompt at all.
- **The same rule on the terminal and Desktop.** Not chosen: the terminal has no other windows to make room for, so it keeps drawing flowcharts as before.

## Consequences

### Positive

- Keep-alive's state and buttons stay above the prompt at every width and on every surface, in one place.
- A resize moves only the lens, and the lens no longer leaves an extra tab inline (R44.8, R44.10).
- Keep-alive has one view to keep right, not three; D13's surface rule is no longer needed, and the `statusText` setting is retired (R44.11).
- In VS Code the lens's mode word says where the lens is (R44.15), and the person can choose the band above the prompt instead of the pane (R44.16).
- Lens writes no longer fail now and then during a resize, and widening draws the step chart again (R44.17, R44.18).
- Widening shows the flowchart in the right pane in both panel types (R44.19), and in VS Code a flowchart is never squeezed above the prompt (R44.20).

### Negative / Trade-offs

- **It rests on observed behaviour, not on the types.** The d.ts still says `AbovePrompt` is terminal and Desktop only (:10818). If a later Claude Code stops drawing it in VS Code, keep-alive has no view there. The probe (2ff, 2.1.310) is the evidence; a live check after each host update covers it.
- **Other surfaces are unchecked.** Only the terminal, Desktop and VS Code have been seen drawing the band. A surface that does not draw `AbovePrompt` shows no keep-alive state, since the status line is gone.
- **The Run List tab may wait undrawn after widening.** In Tab mode the lens opens it itself on docking (R44.12, R44.14). The person did not ask for that open, so the host draws the tab only from 144 columns (110 once the person has opened it and not closed it by hand) and keeps it undrawn below that (d.ts :15066-15074). In Drill in mode no Run List tab opens.
- In a narrow VS Code panel, keep-alive's band and the lens's inline pane region both sit above the prompt, as two separate views. With pinned chosen, the lens's band takes the place of its pane there.
- **R44.4 has an exception.** In VS Code the lens may now draw its band, while the person chose pinned and the lens pane is closed (R44.16). The two lens views must never be up together. The band's hand-over to a pane (`followSeat`, through `afterRender`) keeps them apart, so any change there needs a test.
- **Render-triggered writes can lag.** A write the host keeps refusing is retried for about 2 seconds (20 tries, 100 ms apart) before it shows as a lens error.
- **No flowchart in a narrow VS Code panel.** The person has to widen the Claude panel by hand, because a plugin cannot. Until then the lens shows a line saying so and a dim `⤢`. The rule is VS Code only, so the surfaces now differ: the terminal and Desktop still draw flowcharts in their band.

### Neutral

- Replaces spec decisions that had no ADR: D9's keep-alive Pane on VS Code, D13 (status-line summary, surface rule, `statusText`) and the "no band on VS Code" fallback, in `docs/specs/keepalive-cache-status.spec.r4-delta.md` (rev 4.8).
- The lens's layout already followed `placement`, never pixels (`docs/product/ai-dlc-lens/stories.md`, A16); this record adds the tab handling, the no-band rule in VS Code with its pinned exception (R44.16), the mode that follows the seat (R44.15), the rule for render-triggered writes (R44.17) and, in VS Code, flowcharts in the right pane only (R44.20).

## Compliance Checklist

- [x] Affected components: `plugins/claude/ai-dlc/hooks/keepalive/` (`keepalive.ts`: no `ui.status`, no Pane; `panel.tsx`; `cache-state.ts`: band model), `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` (the `AbovePrompt` hook that draws keep-alive's band), `plugins/claude/ai-dlc-lens/hooks/register.tsx` (`followSeat`, `seatChanged`, `afterRender`, `placePress`, `openLens`, `bandAllowed` with the session value `vscodeBand`, `chartOff` and `fullOff` in `workflowBody` with `ViewSite.wide`, and the band gate `bandEverywhere` from `hooks/lens.ts`), `plugins/claude/ai-dlc-lens/types/index.d.ts` (the `vscodeBand` state).
- [x] Related ADRs: ADR-0006 and ADR-0007 are unaffected (the lens still reads keep-alive's published `$.state`, `chain` included).
- [ ] Return shape `{ data, error }`: not applicable (hooks modules).
- [x] No stack traces exposed: not applicable.
- [ ] DI registration: not applicable (hooks modules).
- [x] No ADR superseded (D9, D10's label rule and D13 had none).
