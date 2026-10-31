# Step 44: live findings after step 43 (the human, 2026-10-31)

Taken after `/reload-plugins` on the step 43 working tree (reviews done: code review 5/5 APPROVE, docs critique PASS), in a narrow VS Code Claude panel. Four screenshots were shown in the chat; they are not in the repository. Below, the human's message verbatim, then the orchestrator's notes and the human's answers.

## Verbatim

> 1. see keepalive-narroeview.png: 2 bugs
>     a. the statusline should have been removed by now because its in the band panel now.
>     b. both keepalive line show current status as off. but the button shows off as well. so when the status shows off, the button would be an on button (not off button). when the status shows on, the button would be an off button (not on button). this rule applies for both 5m (keepalive 5m) and 1h (keepalive 1h) caches.
>         but the line cache keepalive for the master cache currently does not show any status but buttons.
>         it should show: ai-dlc cache-keepalive:
>            i. on (status): when 1h or 5m cache is on or the master is on, with an off button (which turns off both 1h and 5m cache)
>           ii. off (status): when both 1h and 5m cache is off or the master is off, with an on button (which turns on both 1h and 5m cache)
> 2. see lens-narrow-view.png: 1 bugs
>     a. there are 2 lens bands: keep the 1st one and remove the second one.
> 3. see keepalive-lens-naarow view: ok
>
> if any of the bugs are already listed in later runs, ignore them.
> otherwise list them in this run, in a new step, and execute it in a team

## What the screenshots show (orchestrator's reading)

- **1a.** Below the bands, the status line still reads `ai-dlc plugin keepalive 1h: off (no 1h cache write seen), ping 0/9, keep warm 8h (settings) keepalive 5m: off (no 5m cache write seen), ping 0/20, keep warm 1h (settings)`.
- **1b.** In the full keep-alive pane, the rows `keepalive 5m: off (…)` and `keepalive 1h: off (…)` each carry a button labelled `off`. The head row `⚠ ai-dlc cache-keepalive:` has buttons (`off`, `Ping now`, `Maximise`, `Minimise`, `Close`) but no status word. The minimised band reads `⚠ ai-dlc cache-keepalive: on` with an `off` button, while both tracks show off.
- **2a.** With `/ai-dlc:lens` alone, two lens bands are drawn one above the other. The first is headed `AI-DLC Lens` with a one-line list; the second, `From the ai-dlc-lens plugin`, has a wrapped list. Both have `pinned`, `□` and `×`, and the second also has `⤢`.
- **2b** (found by the orchestrator in the same screenshots; the human chose to add it). Both bands list `FEAT-20261020-ai-dlc-lens, scope v2 / Wave 3 Build` as `completed`, but its run state (`run.v4.3.md`) is `status: active`. They also list `RES-20261020-ai-dlc-mods` as completed, which is correct, since it closed on 2026-10-31.
- **3.** The keep-alive band and the lens band shown together are accepted as they are.

## Checked against the records

None of the four is recorded in a later step or in the backlog. Bug 1a reverses the human's decision of 2026-10-25 (run.v4.md entry 2s: "SUMMARY + PANE", a short status-line summary beside the pane). Bug 1b replaces the button-label rule D10 (17.1.26, "label follows allowed").

## The human's answers (2026-10-31)

- 2b is added to step 44.
- Step 44 runs as an agent team (AAWP, limits 2 rounds / 1 failure per review step).

## Requirements for step 44 (binding)

- **R44.1 (1a):** keep-alive no longer writes a status line. Its state is shown only in the band and the pane.
- **R44.2 (1b, tracks):** each track row (`keepalive 5m`, `keepalive 1h`) shows its status, and its button offers the opposite: status `off` gets an `on` button, which turns that track on; status `on` gets an `off` button, which turns it off.
- **R44.3 (1b, master):** the head row reads `ai-dlc cache-keepalive: on` when the 1h or the 5m track is on, or the master is on, with an `off` button that turns both tracks off. It reads `ai-dlc cache-keepalive: off` when both tracks are off, or the master is off, with an `on` button that turns both tracks on. The same rule holds wherever the head row is drawn: the full pane and the minimised band.
- **R44.4 (2a):** `/ai-dlc:lens` draws exactly one lens band in the narrow view: the first one (`AI-DLC Lens`, one-line list). The second is removed.
- **R44.5 (2b):** the lens never shows an `active` or `blocked` run as `completed`. A run's state comes from the current version of its run state (`handoff`, *Run state*, Versions).
