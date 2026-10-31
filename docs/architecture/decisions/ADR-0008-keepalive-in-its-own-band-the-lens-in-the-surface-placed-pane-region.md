# ADR-0008: Keep-alive draws in its own band above the prompt, and the lens lives in the pane region the surface places

**Date**: 2026-10-31
**Status**: Accepted (the human, 2026-10-31, step 44; the build's live check is pending)
**Deciders**: the human (step 44: R44.1, R44.4, R44.7 revised, R44.9 and R44.10 revised, in `docs/handoffs/FEAT-20261020-ai-dlc-lens/44-live-findings.human.md` and `44-live-findings-2.human.md`); agent-manager (host research 44.2.l1.2, facts F1 to F6, and the probe of 44.2.l1.3, run.v4.3.md entry 2ff); software-architect (this record)

## Context

Two modules draw above the prompt: keep-alive (ai-dlc plugin, `hooks/keepalive/`, its band drawn from `hooks/auto-handoff/register.tsx`) and the lens (ai-dlc-lens plugin). Until step 44, keep-alive had three places for its state: a status line (spec D13, a short summary), an `AbovePrompt` band on the terminal and Desktop, and a Pane on VS Code (spec D9). The Pane existed because the types say the band is raised on the terminal and Desktop only (`claude-code.d.ts` 2.1.310, :10818).

Two host facts decide where each module can sit:

- **The surface places the panes, all of them together.** Every pane of every module is a tab of one framed region ("one shown, the rest tabs", d.ts :10867-10868). A module cannot choose where a pane sits: `placement` is read-only (:10897-10903) and `PaneOpenArgs` has no placement (:7589-7660). VS Code moves the whole region by the panel width: inline above the prompt when narrow, docked on the right when wide, at about 70 columns (probe, 2ff: `isFullscreen` flips). There is no resize event (:4098), a module cannot open or close a pane while drawing (:3494), and a pane opened later by a timer is "unasked" and may wait undrawn below 110 or 144 columns (:15067-15074).
- **`AbovePrompt` does render in VS Code.** The probe logged 76 renders with surface `vscode` (2ff), against the d.ts line :10818.

So while keep-alive was a pane, it docked with the lens whenever the panel grew. The human saw both tabs leave the area above the prompt and the band hide (R44.8; cause confirmed by the probe: nothing closed, the region docked). The human wants keep-alive to stay above the prompt at every width, and only the lens to move (R44.7, R44.9, R44.10). With keep-alive's band on every surface, the status-line summary only repeated it (R44.1).

## Decision

We will draw keep-alive only in its own `AbovePrompt` band, on every surface (VS Code included), with no pane and no status line, and we will keep the lens in the pane region, letting the surface decide where it sits and adapting the lens to that seat.

- **Keep-alive.**
  - One band (title row with the master Button, the 5m and 1h rows, the seed row while a track is on), at every panel width. It is outside the pane region, so a resize does not move it.
  - No keep-alive Pane: `/ai-dlc:cache-keepalive` opens none.
  - No status line: keep-alive writes nothing to `ui.status`. The published `$.state` lines are unchanged, so the lens and other readers keep the full text.
- **The lens.**
  - No band of its own in VS Code (R44.4). It is a pane, and the surface seats it: inline above the prompt when narrow, docked on the right when wide.
  - It reads `placement` on each Pane render and adapts out of the render (`$.clock.after`), never during it. Going to inline, it closes its wide-only Run List tab, so the narrow view keeps one lens tab (R44.10). Going to dock, it does not open the Run List tab itself: that open would be unasked and could wait undrawn (R44.9, the deviation the human accepted).
  - On the terminal and Desktop its existing band rules stay.
- **Rule for later modules.** A view that must stay above the prompt at every width is an `AbovePrompt` band, not a pane. A pane goes where the surface puts the region, and its module adapts to `placement`; it never tries to move itself.

## Alternatives Considered

- **Keep-alive stays a tab of the shared pane, beside the lens** (research option (a)). Rejected by the human: it docks with the lens when the panel is wide, which is the R44.8 behaviour.
- **Keep-alive's rows live only inside the lens view** (research option (b)). Rejected: there would be no keep-alive view while the lens is closed, and the two plugins would be coupled for a keep-alive control.
- **The lens re-seats itself on resize** (close and reopen to force inline or dock). Rejected: the host gives no placement argument, no resize event, and no state writes while drawing, and a reopen from a timer is unasked and may stay undrawn (F1, F4 to F6).
- **Keep the status-line summary as a second view.** Rejected by the human (R44.1): it repeats the band, which now draws on every surface.

## Consequences

### Positive

- Keep-alive's state and buttons stay above the prompt at every width and on every surface, in one place.
- A resize moves only the lens, and the lens no longer leaves an extra tab inline (R44.8, R44.10).
- Keep-alive has one view to keep right, not three; D13's surface rule and the `statusText` setting are no longer needed.

### Negative / Trade-offs

- **It rests on observed behaviour, not on the types.** The d.ts still says `AbovePrompt` is terminal and Desktop only (:10818). If a later Claude Code stops drawing it in VS Code, keep-alive has no view there. The probe (2ff, 2.1.310) is the evidence; a live check after each host update covers it.
- **Other surfaces are unchecked.** Only the terminal, Desktop and VS Code have been seen drawing the band. A surface that does not draw `AbovePrompt` shows no keep-alive state, since the status line is gone.
- **Wide VS Code does not get the Run List tab by itself.** After narrow to wide, the lens shows its workflow tab docked; the Run List tab waits for the person to open it (unasked opens, d.ts :15070).
- In a narrow VS Code panel, keep-alive's band and the lens's inline pane region both sit above the prompt, as two separate views.

### Neutral

- Replaces spec decisions that had no ADR: D9's keep-alive Pane on VS Code, D13 (status-line summary, surface rule, `statusText`) and the "no band on VS Code" fallback, in `docs/specs/keepalive-cache-status.spec.r4-delta.md` (rev 4.8).
- The lens's layout already followed `placement`, never pixels (`docs/product/ai-dlc-lens/stories.md`, A16); this record adds the tab handling and the no-band rule in VS Code.

## Compliance Checklist

- [x] Affected components: `plugins/claude/ai-dlc/hooks/keepalive/` (`keepalive.ts`: no `ui.status`, no Pane; `panel.tsx`; `cache-state.ts`: band model), `plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` (the `AbovePrompt` hook that draws keep-alive's band), `plugins/claude/ai-dlc-lens/hooks/register.tsx` (`followSeat`, the band gate `bandEverywhere` from `hooks/lens.ts`).
- [x] Related ADRs: ADR-0006 and ADR-0007 are unaffected (the lens still reads keep-alive's published `$.state`, `chain` included).
- [ ] Return shape `{ data, error }`: not applicable (hooks modules).
- [x] No stack traces exposed: not applicable.
- [ ] DI registration: not applicable (hooks modules).
- [x] No ADR superseded (D9, D10's label rule and D13 had none).
