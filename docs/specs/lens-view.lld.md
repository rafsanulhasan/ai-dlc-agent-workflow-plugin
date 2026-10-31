---
work-item: FEAT-20261020-ai-dlc-lens
kind: lld
feature: lens-view
module: ai-dlc-lens
submodule: view, status
author: system-engineer
date: 2026-10-31
status: draft revision 2 (step 44: the lens view follows the surface's placement, runListStatus, the band gate; sections 3 to 5 are new, section 2 marks what replaces step 43's design); revision 1 is the step 43 design note `docs/handoffs/FEAT-20261020-ai-dlc-lens/43.2-design.md` (agent-manager, 2026-10-26), adopted here by reference and not copied
spec: none for the view; the requirements are `43-requirements.human.md`, `44-live-findings.human.md` and `44-live-findings-2.human.md` (the human's, binding)
handoff: 44.1-orchestrator-to-system-engineer.handoff.md
---

# LLD: the lens view, its placement and its run status (steps 43 and 44)

Paths are under `plugins/claude/ai-dlc-lens/` (`R` = `hooks/register.tsx`, `L` = `hooks/lens.ts`). No code is written here. Agent-manager is building phase B of step 44 as this is written; the code references are for orientation (working tree on 2026-10-31) and the build re-checks them. The lens plugin is Claude-only, so none of this reaches the Copilot build.

There was no LLD for the lens view: step 43's design is the engineering lead's design note (`43.2-design.md`, revision 1 of this document). It stays the record of the view modes (`bandMode`, `paneMode`), the controls by site, the opening sources and the layouts. This revision records what step 44 changes and nothing else.

## 1. Inputs and host facts

- The human's requirements: R44.4 (one lens view; revised: the lens shows no band of its own in VS Code), R44.5 (an active run is never `completed`), R44.7 to R44.10 as revised (the lens alone follows the panel's width; keep-alive does not).
- Host facts from `44.2.l1.2-agent-manager-to-orchestrator.handback.md` (d.ts 2.1.310): F1 a module cannot choose where a pane sits; the surface places every pane, and `placement` is read-only on the Pane props. F2 all panes form one framed region, one shown and the rest tabs; VS Code moves the whole region between inline (narrow) and the dock (wide). F4 there is no resize event; a resize arrives as a fresh `ui.render` with new `placement` and `bodyColumns`. F5 a module cannot open or close a pane, or write state, while drawing; a reaction is deferred out of the render (`$.clock.after`). F6 a deferred open is "unasked": placed only from 144 columns (110 for an id the person has opened before and not closed by hand), below that it waits undrawn.
- The probe of 44.2.l1.3 (`run.v4.3.md`, entry 2ff): `AbovePrompt` renders in VS Code (surface `vscode`), so F3 of the research does not hold; VS Code moves the pane region at about 70 columns (`isFullscreen` flips); R44.8's cause is that region moving, with no close by any module.

## 2. What replaces step 43's design (43.2-design.md)

| Where in 43.2 | Fate | By |
|---|---|---|
| 3, row `/ai-dlc:cache-keepalive`: "VS Code (no band) still opens the Pane" | replaced: keep-alive has no pane | keep-alive LLD, 26.1 |
| 3, row "Keep-alive band `⤢`" (opens the keep-alive Pane on any surface) | replaced: no keep-alive Pane, so no such control | keep-alive LLD, 26.2 |
| Step 43's rule that VS Code shows keep-alive as the tab of a pane, and `D4`-style claims that a VS Code session has no band | replaced for keep-alive: it is its own band above the prompt, narrow and wide; the lens keeps "no band of its own in VS Code" | 5, keep-alive LLD, 26.1 |
| 1, `LensView` fields, 2 controls, 3 lens rows, 4, 5 layouts, 6 status fixes | stand; 6.2 (the run state decides done) is amended by 4 | 4 |
| Live findings 3: `commandSeatOf`, `commandOpenView` | stand; they decide where `/ai-dlc:lens` opens, and 3 adds the other direction | 3.3 |

## 3. The view follows the placement (R44.9, R44.10)

### 3.1 The rule

The lens does not move its panes; the surface does (F1, F2). The lens only keeps what is shown consistent with where the surface has put the region, in two cases, both about its wide-only **Run List tab** (`RUNS`). Narrow, the view is exactly one lens pane; wide, it is the two docked tabs (the workflow tab and the Run List tab).

| Transition (the lens pane's `placement`) | What the surface does | What the lens does |
|---|---|---|
| inline to dock (the panel grows from narrow to wide), R44.9 | docks the whole region; the lens tab goes with it to the right pane | nothing: it does **not** open the Run List tab. Such an open is unasked and, below the floors of F6, waits undrawn, so the lens avoids an act it cannot verify. The Run List tab is opened by `/ai-dlc:lens` (3.3) |
| dock to inline (the panel shrinks from wide to narrow), R44.10 | moves the region back above the prompt; the right pane closes; the lens tab is in the band-position again | closes the Run List tab, deferred out of the render, so the view is one lens pane again |

Keep-alive is not in this region (its own band, keep-alive LLD 26) and so is never moved or closed by a resize.

### 3.2 Mechanism

- Input: the `placement` and `bodyColumns` props of a lens Pane render, read in the Pane hooks of `CHART` and `RUNS` (R:4355 to R:4380, the workflow and Run List panes), and recorded by `notePaneSeat(placement, columns)` (module memory, no state write, `paneSeat`, also read by `commandSeatOf`). The agent and edge panes record the seat but do not follow it.
- State: a module variable `lastSeat: 'dock' | 'inline' | null`, `null` on load. It is memory, not an atom: a state write while drawing is denied (F5; the step 43 live error "command open state.set denied during ui.render"), and nothing else reads it.
- `followSeat($, placement)`, called by the `CHART` and `RUNS` Pane hooks beside `notePaneSeat`: an unknown `placement` or one equal to `lastSeat` does nothing; otherwise `lastSeat` takes it; on `inline` it schedules, with `$.clock.after(0, ...)`, `$.ui.close({ id: RUNS })`, whose rejection is logged (`lensFail('runs tab close', err)`), never thrown; on `dock` it does nothing more. `$.ui.close` of an id that is not open does nothing (d.ts 2538), so the first inline draw after a load, or a Run List tab the person already closed, is harmless. One close per change to `inline`, not per render.
- Why deferred: the close is an act, and a render only draws (F5). Why a change test: the render runs again on every redraw, and a close per render would race the surface. Why no timer is relied on for the open: F6.
- Residual, unconfirmed live: that a close scheduled from a timer is honoured (the research found it "not documented as refused"). The probe saw the Run List tab close on wide to narrow (entry 2ff: "wide to narrow closes the Run List tab"), which is the evidence for it; the manual check of 6 confirms it again after the build.

### 3.3 `/ai-dlc:lens` (unchanged, stated for the whole picture)

The command picks the seat from the last drawn lens pane: `commandSeatOf(seen, wideColumns)` is `dock` only for a docked pane at a wide width (the Run List and workflow tabs open), else `inline` (one pane, the minimised list; the safe choice for a narrow panel). On a surface with no lens band it opens the pane; on a surface that draws the band it follows the pinned or docked rules of 43.2, 3. This is the only place the Run List tab is opened.

## 4. `runListStatus` (R44.5)

```ts
// L:1552
export function runListStatus(members: readonly StatusMember[], runStatuses: readonly string[] = [], spawner: string | null = null): FlowStatus
```

- Rule: `runListStatus` is `workflowStatus(...)` except that a result of `completed` becomes `waiting` when any listed run's status is `active`. Every other result (`halted` for a `blocked` run or a failed or killed agent, `in-progress`, `waiting`, `pending`) passes through unchanged. `workflowStatus` keeps its own order: `blocked` run, then all runs `done`, then failed or killed agents, then running, waiting, pending, completed.
- The old fault: `workflowStatus` returned `completed` as soon as every agent had ended, whatever the run said (`L:1542` before step 44). A run waiting for its next stage or for the human is not completed, so it reads `waiting`.
- The run's status is that of its **current** run-state version: the newest version wins (`pickRunState`, `L:2769`; `readRunState`, `R:681`). Nothing changed there: the human's R44.5 ("the newest run-state version wins").
- Who calls which: the run list and the band take `runListStatus` (the run-list builder at `R:2005`: `status: runListStatus(settled, dirs.map(d => runs[d]?.status ?? ''), batch.parent)`). A step's chart and the step accordion keep `workflowStatus`, since a finished step of an active run is `completed`. This amends 43.2, 6.4 ("one input: the step accordion's status takes the same run statuses as the band"): the two take the same inputs but not the same function, on purpose.
- Truth table (members all ended, no failed or killed agent): run statuses `[]` gives `completed` (no run state, as before); `['done']` gives `completed`; `['active']` gives `waiting`; `['active', 'done']` gives `waiting`; `['blocked', 'active']` gives `halted`. A run with a failed agent is `halted` whatever its run state says (as before). In the minimised list the precedence is in progress, waiting, halted, pending, completed (the human, entries 2dd and 2de), so an active run now sorts above a halted one.

## 5. One lens view per surface, and the band gate (R44.4 revised)

- The lens band (`AbovePrompt`, `R:4388` to `R:4410`) is drawn only where every attached surface draws it: `bandEverywhere(surfaces)` (`L:2226`), true when the surface list is non-empty and every entry is in `BAND_SURFACES` (`terminal`, `desktop`; `L:2223`). `/ai-dlc:lens` uses the same predicate (`onBand`) to choose between the band and the pane. One predicate, so the command and the hook cannot disagree. In VS Code, or with the surfaces unknown, the pane is the view and no lens band is drawn: the second lens band the human saw is gone.
- `AbovePrompt` itself is raised in VS Code (the probe). The gate is the lens's own decision, not a limit of the host. Keep-alive's band is not gated (keep-alive LLD, 26.1), so in VS Code the order above the prompt is: auto-handoff's panel, keep-alive's band, with the lens in the pane region.
- `surfacesNow($)` reads the roster per render of the band hook; whether that cost is worth a cached copy is not decided here (code review's open suggestion, entry 2ez).

## 6. Tests and seams (sqa-44 owns the tests)

| Seam | Observes | Rule |
|---|---|---|
| Pure, `lens.test.tsx` | `runListStatus` over the truth table of 4, and `workflowStatus` unchanged for the chart; `bandEverywhere` over `['terminal']`, `['desktop']`, `['vscode']`, `['terminal', 'vscode']`, `[]` | R44.4, R44.5 |
| Lens harness, stub `$` | a Pane render of `CHART` with `placement: 'inline'` after `'dock'` schedules one `ui.close({ id: RUNS })` through `$.clock.after`, none inside the render; the same placement twice schedules nothing more; `'dock'` after `'inline'` opens nothing; a rejecting close is logged and not thrown; the band hook returns `next(e)` for surface `vscode` | R44.9, R44.10, R44.4 |
| Manual (`MANUAL-CHECKS.md`, the implementer's) | narrow to wide and wide to narrow in VS Code: the lens moves with the region, the Run List tab closes on narrowing and is not opened on widening, keep-alive's band is untouched | R44.8 to R44.10 |

A design suggestion for testability, not a decision: the transition table of 3.1 is a pure function of `(lastSeat, placement)` (`'none' | 'closeRuns'`); extracting it into `lens.ts` beside `commandSeatOf` would let the rule be tested without the engine, as 43.2 asks for the other view helpers. agent-manager decides whether the build already has it.

## 7. Revision history

| Rev | Step | Date | Change |
|---|---|---|---|
| 1 | 43 | 2026-10-26 | `43.2-design.md` (agent-manager): view modes, controls, opening sources, layouts, status fixes. Kept as written |
| 2 | 44 | 2026-10-31 | this document: placement following (3), `runListStatus` (4), the band gate (5), the replaced rows of 43.2 (2) |

## 8. Open questions

1. **A narrow to wide open of the Run List tab.** The human's R44.9 says the lens "opens in the right pane"; the records show only the lens (workflow) tab docking with the region, and the Run List tab not being opened (an unasked open waits undrawn below the floors of F6). Whether the human wants the Run List tab opened when the panel is wide enough (110 or 144 columns) is not recorded. Not built as such.
2. **The stale comment.** `R` near line 4352 says "VS Code has no band at the top of the chat; AbovePrompt is terminal and desktop only", which the probe contradicts. agent-manager owns the code.
3. **The step chart's pane.** The follow closes only `RUNS`. Whether a drilled agent or edge pane (`AGENT`, `EDGE`) should also be reconciled on a placement change is not stated by any record.
