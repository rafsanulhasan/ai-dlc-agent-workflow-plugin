# keep-alive: manual checks in the terminal and VS Code

The checks of the keep-alive hooks module that `claude plugin test` cannot make: what the host paints on screen, outside any hook event. Each row is run by a person, in a live session, on each surface it names. Write the result (pass or fail, the surface, the date, the Claude Code version, and what was on screen when it failed) in the *Result* column.

The automatic tests are in `tests/keepalive.test.ts` and `tests/cache-state.test.ts`. Run `FEAT-20261020-ai-dlc-lens`, feature root 17.

## The ping counter on screen (T17.4, ITEM-035)

AC-17.4.4 (stories `docs/product/active/session-continuity-and-cache-visibility/sprint-1/keepalive-cache-status/stories.md`, US-17.4): after a ping lands, the timer callback renders the new line outside any hook event. The tests check the recorded `ui.status` call, not what the host paints. This check tells the two apart.

**Interval used for the check:** `AI_DLC_KEEPALIVE_1H_PING_EVERY=2m` in the `env` of `.claude/settings.local.json` (one developer's file, not committed, and not trust-gated). With it the 1h track pings every 2 minutes; its ping limit stays 9 and its keep-warm time 8h. Remove the variable after the check.

| # | Steps | Expected | Result |
|---|---|---|---|
| P1 | 1. In `.claude/settings.local.json`, add `"AI_DLC_KEEPALIVE_1H_PING_EVERY": "2m"` under `env` (create `env` if it is missing). 2. Start a new session: first in the terminal (`claude`), then repeat every step in the VS Code extension. Open the lens (`/ai-dlc:lens`) and leave its keep-alive section in view. 3. Send one prompt that starts a background task running longer than 5 minutes, for example: "Run `sleep 400` in the background with the Bash tool and end your turn without waiting for it." 4. When the turn ends, write down the time (T) and the 1h status line. Do nothing else in the session: no prompt, no command, no click in the chat. 5. At T + 2m and T + 4m, read the 1h status line on screen, and the 1h track's `ping k/9` in the lens's keep-alive section (the published `pings`), without typing or clicking. Write down, for each reading, the line and the time it changed. 6. Remove the variable from `.claude/settings.local.json`. | At T the 1h line reads `keepalive 1h: main warm until …; armed, 1 task(s), warm until …, ping 0/9, first ping at <T + 2m>, keep warm 8h, stop by …`. If it reads `off (no 1h cache write seen)`, the session wrote no 1h cache: the check cannot run; write that down. Within 10 seconds of T + 2m, with no other event, the line on screen changes to `… ping 1/9, keep warm 8h, …` (no `first ping at`); within 10 seconds of T + 4m to `ping 2/9`. The lens shows the same `k` as the screen at each reading. Fails when the screen keeps `ping 0/9` (or the previous `k`) after the lens shows the new one: then po's Q17-4 decision applies (a README limitation and a backlog item; root 17 is not blocked). | Terminal: ; VS Code: |
