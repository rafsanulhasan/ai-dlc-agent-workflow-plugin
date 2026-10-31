---
work-item: FEAT-20261020-ai-dlc-lens
root: 17 (reopened by step 44)
kind: user-stories (delta)
author: product-owner
date: 2026-10-31
revision: 1 (step 44, handoff 44.1-orchestrator-to-product-owner)
status: draft, awaiting product-owner acceptance by the orchestrator's review; building is in progress (step 44, am-44 phase B), tests and reviews pending
epic: session-continuity-and-cache-visibility
module: ai-dlc
submodule: cache-keepalive
feature: keepalive-cache-status
items: ITEM-068 (reopened); new item numbers are the product-manager's to assign
inputs: docs/handoffs/FEAT-20261020-ai-dlc-lens/44-live-findings.human.md (R44.1 to R44.6, with the human's three clarifications); 44-live-findings-2.human.md (R44.7 to R44.10, with the human's answers); 44.2.l1.2-agent-manager-to-orchestrator.handback.md (host facts F1 to F6); run.v4.3.md entries 2eo to 2ff
---

# User stories delta, step 44: keep-alive state without a status line, in its own band, with buttons that offer the opposite (root 17)

This file is a delta to `stories.delta-r4.md` (rev 4.6), which is itself a delta to `stories.md` (rev 3). It records what the human decided on 2026-10-31 after the live checks of steps 43 and 44. Nothing in the older files is deleted: superseded text stays, marked, so the history reads. AC ids in `stories.delta-r4.md` are not reused; the new story is US-17.8 and its ACs are AC-17.8.1 onward.

## What the human decided (binding, 2026-10-31)

| Id | Decision | Source |
|---|---|---|
| R44.1 | Keep-alive writes no status line. Its state is shown only in its band. | `44-live-findings.human.md` |
| R44.2 | Each track row shows its switch in force as its status, and its button offers the opposite. | same, clarification 1 |
| R44.3 | The tracks decide the head row; its button turns the master and both tracks off or on. | same, clarification 1 |
| R44.6 | While both tracks are off there is no seed row. | same, clarification 3 |
| R44.7 (revised) | In VS Code, keep-alive is its own band above the prompt (the `AbovePrompt` site), separate from the pane region, narrow and wide alike. It opens no pane. | `44-live-findings-2.human.md`, answers |
| R44.8 | Resizing must not remove the tabs or hide the band. Cause confirmed by the probe (below). | same |
| R44.9, R44.10 (revised) | Only the lens moves with the panel width. Keep-alive's band is not affected by a resize. (Lens side: `docs/product/ai-dlc-lens/stories.md`, AC-12.12 to AC-12.16.) | same |

Probe finding that bears on R44.8 (run.v4.3 entry 2ff, logs of 2026-10-31 11:55 to 11:58 UTC): `AbovePrompt` does render in VS Code (surface `vscode`), the host's type file is wrong on this point for 2.1.310; VS Code moves the whole pane region between inline and docked at about 70 columns; the human's "tabs vanish, band hidden" was that region moving, with the area above the prompt left empty. With keep-alive out of the pane region (R44.7), nothing of keep-alive's lives in it to be moved.

## Supersession

The older rev 4.x text below is **superseded** and must not be built or tested against. Where the older text is in `stories.delta-r4.md`, it keeps its place there with this note pointing here.

| Superseded | By | What changes |
|---|---|---|
| AC-17.6.1, 6.2 (status line parts), 6.3 (status line parts), 6.5, 6.33, 6.35 (status line in full mode), 6.36 (`statusText` row), 6.37, 6.38, 6.39, 6.40, 6.41; the summary strings S1 to S6; the *Summary* and *Status mode* terms; AC-17.4.4 to 17.4.6 where they read the summary | R44.1, AC-17.8.1 | There is no status line and so no summary, no `statusText` mode, no 72-character rule and no status-line surface rule. The full track line stays: it is the band row and the published `line`. Decision 11 to 13 of `stories.delta-r4.md` (the "Summary + Pane" decision of 2026-10-25, `run.v4.md` 2s, 2t, 2v) is reversed by the human. |
| AC-17.6.9, 6.10, 6.11, 6.30 (Pane parts) and the *Pane* term | R44.7, AC-17.8.8 | No keep-alive Pane in VS Code; the band is drawn there. `/ai-dlc:cache-keepalive` still pings and reports but opens no pane. |
| The *Band* term ("Terminal, Desktop") and AC-17.6.9's "no AbovePrompt band is drawn in VS Code" | AC-17.8.8 | The band is drawn on every surface including VS Code. |
| AC-17.6.12 and AC-17.6.22 (Q-SL8, "the button follows allowed, not running"; spec D10, run.v4.2 17.1.26) | R44.2, AC-17.8.4, AC-17.8.5 | The button follows the status the row shows, which is the switch in force. |
| AC-17.6.23 last sentence ("the master button depends on the master alone, never on the tracks") and the *Master button* term | R44.3, AC-17.8.6 | The head row, its status word and its button are decided by the tracks. |
| AC-17.6.6 and AC-17.6.9 seed row rules | R44.6, AC-17.8.7 | The seed row shows only while a track is on. |
| E1', E2', E3', E4', E5', E8 (an idle but allowed track reads `off (<reason>)`) | R44.2, AC-17.8.2, open question Q44-1 | An allowed idle track reads `on, idle (<reason>)`. E9 (`off (disabled)`) is unchanged. |
| The step 43 reading of R44.4 ("no band below the pane", keep-alive as a tab of the pane region, human's "keepalive-lens narrow view: ok" of 2026-10-31 and the "Remove B always" clarification) | R44.7, AC-17.8.8 | Keep-alive leaves the pane region: it is its own band. The lens keeps "no band of its own in VS Code". |

Unchanged by step 44: the session-only press effects (AC-17.6.13 to 6.17, 6.24 to 6.29, 6.32; no settings file is written), the published `$.state` keep-alive value including `line`, `sessionMaster`, `sessionSwitch` (AC-17.6.20: "The published `$.state` lines are unchanged", R44.3 clarification), the source note and `sourceNote` (AC-17.6.34, 6.35 for the full line), the handoff chain (US-17.7), the Terminal and Desktop band.

## Terms (changed or added)

- **Switch in force** (per track): the track's state after the order in `stories.delta-r4.md`, *Track enabled for this session*: `on` when the track is enabled for this session (the master is already folded in), `off` otherwise. This is the status a track row shows (R44.2).
- **Head row**: the first row of the keep-alive band: the bold text `⚠ ai-dlc cache-keepalive:` followed by the head status, then the head button. The head status is `on` when either track is on in force, else `off` (R44.3). (Before step 44 the head row carried no status word and the master button.)
- **Keep-alive band**: the `AbovePrompt` band keep-alive draws, on every surface that renders it, VS Code included (R44.7). It is separate from the pane region and from the lens.
- **Running text**: the part of a running track's line after the cache part, as AC-17.6.4 and E6, E7 give it.

## Story

### US-17.8 Keep-alive state in one band, with honest statuses and buttons that offer the opposite (ITEM-068, reopened)

As a developer, I want keep-alive's state in one band above the prompt, where each row's status is the real switch state and its button does the opposite, so that I never read `off` next to an `off` button, and so that the band is not hidden or moved when I resize the panel.

**No status line (R44.1)**

- AC-17.8.1 `[PT]` Given any keep-alive state on any surface (stubbed surface roster `['terminal']`, `['desktop']`, `['vscode']`, `['terminal', 'vscode']`, `[]`), when the module renders and when a ping, a Stop, a press or a session event occurs, then keep-alive makes no call that writes a status line (a spy on `$.ui.status`: zero calls), the settings `status` and `statusText` change nothing visible, and the published value is unchanged (each track's `line` is its full line; `sessionMaster`, `sessionSwitch` as AC-17.6.20). The band shows the state (AC-17.8.2 to AC-17.8.7). The settings `status` and `statusText` are an open question (Q44-2).

**Track rows (R44.2)**

- AC-17.8.2 `[PT]` Given each track's switch in force, when its row renders, then the row's status is the switch in force and the row text is one of:
  - switched on and idle: `keepalive 5m: on, idle (no 5m cache write seen), ping 0/20, keep warm 1h` (the human's own example for the 5m track with no write; with the source note `(default)` after `keep warm 1h` while `sourceNote` is on, Q44-3; the 1h track reads `keepalive 1h: on, idle (no 1h cache write seen), ping 0/9, keep warm 8h`);
  - switched off: `keepalive 5m: off (disabled), ping 0/20, keep warm 1h` (E9's form, unchanged);
  - running: `keepalive 5m: on, <running text>` (E6, E7 text after `on, `).
  The other idle reasons of `stories.md` US-17.2 (a cache of that lifetime seen but no background tasks, an expired cache, a turn running, subagents, overage) take the same `on, idle (<reason>)` form; their exact text is Q44-1.
- AC-17.8.3 `[PT]` Given a row whose status reads `on`, when the fixture is rendered, then the row never reads `off` in its status position, and given a row whose status reads `off`, then it never reads `on`: the row status and the switch in force agree for every combination of the master (on, off, unset), the track session switch (on, off, unset) and a settings `<track>.enabled` (true, false), all 18 combinations, enumerated in the test from the order of *Track enabled for this session*.
- AC-17.8.4 `[PT]` Given a track row, then it has exactly one button, and the button offers the opposite of the status: status `on` (idle or running) → `[off]`, which switches that track off for this session; status `off` → `[on]`, which switches that track on for this session. This replaces AC-17.6.12 (Q-SL8): the button follows the switch in force, which is what the row reads.
- AC-17.8.5 `[PT]` Given any press of a track button, then its effect is the one AC-17.6.13 to 6.17 and 6.32 give (session only, no settings file written, a track `[on]` arms only as rev 3 D5 and Q-SL1 say, nothing is pinged at the press), and after the press, within one render, the row's status and button have switched, the other track is unchanged and the head row is recomputed (AC-17.8.6).

**Head row (R44.3)**

- AC-17.8.6 `[PT]` Given the head row, then:
  - it reads `⚠ ai-dlc cache-keepalive: on` when the 1h track or the 5m track is on in force, with one button `[off]`, which turns the master and both tracks off for this session (the master `[off]` of AC-17.6.24, 6.25);
  - it reads `⚠ ai-dlc cache-keepalive: off` when both tracks are off in force, with one button `[on]`, which turns the master and both tracks on for this session (the master `[on]` of AC-17.6.28, "force both tracks on", Q-SL7);
  - it is decided by the tracks alone, so "master on, both tracks off" reads `off` with `[on]`, and "master off, one track on in force (its session switch on)" reads `on` with `[off]`;
  - the same rule holds wherever the head row is drawn: the keep-alive band on every surface.
  Fixtures: the 9 combinations of (1h in force on, off) x (5m in force on, off), plus the two quoted cases. The published `$.state` lines are unchanged.

**Seed row (R44.6)**

- AC-17.8.7 `[PT]` Given both tracks off in force, when the band renders, then it shows the head row `⚠ ai-dlc cache-keepalive: off` with its `[on]` button and the two track rows, and no seed row (`keepalive seed: …`); given a press makes a track on in force, then the seed row shows again at the next render if the seed line has one to show. The published value still carries the seed line.

**Placement and resize (R44.7, R44.8, R44.9, R44.10)**

- AC-17.8.8 `[PT]` Given a VS Code session (surface `vscode`), narrow or wide, when keep-alive renders, then the keep-alive band is drawn through the `AbovePrompt` site, with the head row, both track rows and, per AC-17.8.7, the seed row, and keep-alive opens no pane of its own: no call to `$.ui.open` by keep-alive on any surface, whether `/ai-dlc:cache-keepalive` is run or not (the command still pings and reports). The same band is drawn in the Terminal and Desktop. The lens draws nothing of keep-alive's rows (it reads the published value only, as before).
- AC-17.8.9 `[PT]` Given the keep-alive band drawn and the lens open, when the surface placement changes from inline to dock and from dock to inline (stubbed render props, the two directions), then the keep-alive band is drawn after each change, with the same rows and buttons, and it is not hidden, emptied or moved into the pane region. This is the R44.8 fix: the band is out of the region that moves.
- AC-17.8.10 `[MV]` Given a live VS Code session (extension 2.1.310 or later) with keep-alive and the lens both open, when the human resizes the panel narrow to wide and wide to narrow, then the keep-alive band stays above the prompt at every width and does not disappear, and the lens moves as in `docs/product/ai-dlc-lens/stories.md` AC-12.14 to AC-12.16. Steps: reload plugins; open both in a narrow panel; widen the panel past about 70 columns; note the keep-alive band; narrow it again; note it again; press a track button and the head button at each width. Record the screen and time, as the probe did.
- AC-17.8.11 `[MV]` Given a live Terminal or Desktop session, when a turn ends with a background task and a 1h cache, then the band shows the head row, both rows and (while a track is on) the seed row, with the status words and buttons of AC-17.8.2 to AC-17.8.6, and no status line is written. Steps: read the host's status line area (no keep-alive text), read the band, press `[off]` on a running track and read the rows and the head row, press the head button and read, press the head `[on]` and read; record.

## Scope and priority

- These are corrections to behaviour the human found wrong in live use, inside the existing keep-alive feature (root 17, ITEM-068 reopened). They add no new capability and nothing moves to a later milestone: they ship in 1.0.0-preview1 with the step. Priority is the same as ITEM-068 (P1, a bug against shipped behaviour); the product-manager records it. **Assumption — needs human confirmation:** no item here is a security fix or a regression that would make it P0.
- Dropped from the build plan by R44.1 and R44.7 (they were accepted by the human on 2026-10-25 and are now reversed by the human on 2026-10-31): the status-line summary (and with it `statusText`), the VS Code Pane for keep-alive, and the surface roster rule. The work already built for them is the build's to remove or keep inert (Q44-2), not a product decision.

## Open questions (for the human, via the orchestrator)

- **Q44-1 Exact idle texts.** R44.2 fixes the text for an allowed idle track with no write (`on, idle (no 5m cache write seen)`) and for a disabled track. The other idle reasons (E1' to E4': cache seen, no background tasks, expired, turn running, subagents, `off in overage`, and stopped lines) are not given. My reading is the same shape, `on, idle (<the reason the line gave in parentheses>)`, with the cache part kept before it. **Assumption — needs human confirmation**; the built wording at `cache-state.ts` (am-44) is the evidence to compare with.
- **Q44-2 What the settings `status` and `statusText` do now.** With no status line, `status: false` and `statusText` have nothing to switch (code review already noted `statusText` as inert). Options: remove them and their variables from the settings, schema and configure command; keep them accepted but inert; or make `status: false` hide the band. Default I recommend: keep accepting them, documented as having no effect, so no existing settings file is rejected, and decide removal later. This is a human decision because it changes a settings surface.
- **Q44-3 Source note in the human's example.** The human's R44.2 example reads `… ping 0/20, keep warm 1h` without `(default)`. AC-17.6.34 and 6.35 put the source note on by default (`sourceNote: true`). I assume the example was shortened, not that the note is dropped. **Assumption — needs human confirmation.**
