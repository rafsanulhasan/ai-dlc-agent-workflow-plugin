# Step 43 live findings, round 3 (human, 2026-10-26, VS Code NARROW Claude panel, after /reload-plugins; run.v4.md 2dv)

1. /ai-dlc:cache-keepalive now opens TWO panes/bands when VS Code is narrow. Keep the one that opens as a new tab in the band (the earlier one); remove the new, second one.
2. /ai-dlc:lens now opens TWO panes/bands when narrow. Keep the old one that opens as a new tab in the band, but with the NEW design (minimised, showing the run list: top 3); remove the other one that shows the workflow view.
(Likely: in a narrow panel the wide-case second pane (keep-alive Pane / lens Run List or Workflow tab) is also opened and the surface seats it inline too. Narrow must open exactly one pane per command.)
3. Live error (human): `lens hook error: command open: HooksError: ai-dlc:lens: state.set: denied: it was made while ui.render is being dispatched, and drawing is pure ... (host check)`. The command-open path still writes state during a render somewhere (the clock.after(0) fix did not cover every path, or the callback runs inside a render dispatch).
4. Bug (human): keep-alive band MINIMISED shows the master as off while it is on; after maximise/restore it shows the right status. The minimised row reads stale or different state.
5. Change (human): /ai-dlc:cache-keepalive takes NO arguments and changes no settings: it only opens the band. All the arguments it accepts today (durations, clear, on, off, --track, --session, --machine) move to /ai-dlc:cache-keepalive-configure, which configures the settings. (Keep /ai-dlc:cache-keepalive-configure's existing behaviour; if the two argument sets clash, report it.)
6. /ai-dlc:cache-keepalive-configure on|off (human, 2026-10-26): by default writes the local override; a new `--scope` picks the target:
   - `--scope just-me` (default): `.claude/settings.local.json`
   - `--scope team`: `.claude/settings.json`
   - `--scope global`: `~/.claude/settings.json` on this machine
   Every scope ALSO writes to `.ai-dlc/cache-keepalive.json`, which stores each scope's settings separately (one section per scope). Reconcile with the existing AI_DLC_KEEPALIVE_SCOPE / --machine; report clashes.
7. /ai-dlc:cache-keepalive (no args) uses the settings configured with /ai-dlc:cache-keepalive-configure for its pinging (no settings of its own).
8. The keep-alive band gets a "Ping Now" button. All of the band's buttons show ICONS when the band is minimised (text labels when full).
6a. Human's answers on point 6 (2026-10-26): the flag is `--for just-me|team|global` (the old scope / --session / --machine keep their meaning); it covers on/off AND keep-warm times (and can combine with --session); precedence just-me (local) > team > global > the team file > default, global not trust-gated; .ai-dlc/cache-keepalive.json records the TEAM values only (a record, not read for precedence; personal values never go there). Untrusted-folder team write: warn (lead's default, from am-43's proposal; the human did not object).
