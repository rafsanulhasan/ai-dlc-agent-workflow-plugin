---
name: keepalive
description: "Pings the prompt cache now, or sets how long keep-alive keeps it warm while background tasks run (Claude Code only). /ai-dlc:keepalive [<n>m|<n>h|<n>d|clear] [--session|--machine]."
argument-hint: "[<n>m|<n>h|<n>d|clear] [--session|--machine]"
disable-model-invocation: true
---

# Keep-alive

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that this command does not apply there and stop.

In Claude Code, the ai-dlc plugin's hooks module answers `/ai-dlc:keepalive` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:keepalive` | Pings now and reports the hit rate and the keep-warm time in force |
| `/ai-dlc:keepalive 2h` | Sets the keep-warm time of both tracks in the default scope. Does not ping |
| `/ai-dlc:keepalive 2h --session` | Sets it for this session only |
| `/ai-dlc:keepalive 1d --machine` | Sets it for every session on this machine until cleared |
| `/ai-dlc:keepalive clear`, `/ai-dlc:keepalive clear --machine` | Removes the override in that scope |

If you are reading this in Claude Code, the module did not answer: the ai-dlc hooks module is not loaded (Claude Code older than 2.1.287, or the plugin's hooks are turned off). Tell the person that, point them to the keep-alive README in the plugin (`hooks/auto-handoff/keepalive/README.md`), and do nothing else: never ping or change a setting yourself.
