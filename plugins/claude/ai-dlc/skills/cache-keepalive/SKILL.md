---
name: cache-keepalive
description: "Pings the prompt cache now, turns keep-alive or a track on or off, or sets how long keep-alive keeps it warm while background tasks run, on the 1h track, the 5m track or both (Claude Code only). /ai-dlc:cache-keepalive [<n>m|<n>h|<n>d|clear|on|off] [--track 1h|5m|both] [--session|--machine]."
argument-hint: "[<n>m|<n>h|<n>d|clear|on|off] [--track 1h|5m|both] [--session|--machine]"
disable-model-invocation: true
---

# Keep-alive

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that this command does not apply there and stop.

In Claude Code, the ai-dlc plugin's hooks module answers `/ai-dlc:cache-keepalive` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:cache-keepalive` | Pings now and reports the hit rate and the keep-warm time in force on each track. Any run also brings back the band above the prompt when its `×` closed it |
| `/ai-dlc:cache-keepalive 2h` | Sets the keep-warm time of both tracks in the default scope. Does not ping |
| `/ai-dlc:cache-keepalive 30m --track 5m` | Sets it for the 5m track only; `--track 1h` for the 1h track, `--track both` (the default) for both |
| `/ai-dlc:cache-keepalive 2h --session` | Sets it for this session only |
| `/ai-dlc:cache-keepalive 1d --machine` | Sets it for every session on this machine until cleared |
| `/ai-dlc:cache-keepalive off`, `/ai-dlc:cache-keepalive on --track 5m` | Turns keep-alive (or the tracks `--track` names) off or on by writing `AI_DLC_KEEPALIVE_ENABLED` (or `AI_DLC_KEEPALIVE_1H_ENABLED`, `AI_DLC_KEEPALIVE_5M_ENABLED`) to the `env` of `.claude/settings.local.json`, which wins over `.claude/settings.json` and `.ai-dlc/cache-keepalive.json`; this session's band switch for it is dropped so the value applies now. Does not ping |
| `/ai-dlc:cache-keepalive off --session` | Turns it off (or on) for this session only, as the band's buttons (and the lens's Cache Lab buttons) do; no file is written |
| `/ai-dlc:cache-keepalive clear`, `/ai-dlc:cache-keepalive clear --track 5m --machine` | Removes the override of the tracks named (both unless `--track` is given) in that scope |

The team's keep-alive settings, in `.ai-dlc/cache-keepalive.json`, are created with `/ai-dlc:cache-keepalive-install`, brought up to date with `/ai-dlc:cache-keepalive-merge`, and shown and changed with `/ai-dlc:cache-keepalive-configure`.

If you are reading this in Claude Code, the module did not answer: the ai-dlc hooks module is not loaded (Claude Code older than 2.1.287, or the plugin's hooks are turned off). Tell the person that, point them to the keep-alive README in the plugin (`hooks/keepalive/README.md`), and do nothing else: never ping or change a setting yourself.
