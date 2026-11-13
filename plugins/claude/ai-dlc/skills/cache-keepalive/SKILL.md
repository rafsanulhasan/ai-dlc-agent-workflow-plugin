---
name: cache-keepalive
description: "Pings the prompt cache now with the settings in force and shows keep-alive's band above the prompt, minimised, on every surface; takes no arguments and changes no setting (Claude Code only). Keep-warm times and on/off are /ai-dlc:cache-keepalive-configure."
disable-model-invocation: true
---

# Keep-alive

**Claude Code only.** On GitHub Copilot there is no keep-alive: say that this command does not apply there and stop.

In Claude Code, the ai-dlc plugin's hooks module answers `/ai-dlc:cache-keepalive` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:cache-keepalive` | Shows the keep-alive band above the prompt, minimised, bringing it back when its `×` closed it, on every surface, VS Code included; keep-alive opens no pane. It pings now with the settings in force (those `/ai-dlc:cache-keepalive-configure` set) and reports the hit and the keep-warm time on each track; while keep-alive is off it pings nothing and says why. It takes no arguments and changes no setting; any argument is ignored and the reply says so. The band also has a **Ping now** button: minimised, its buttons are icons (`⏻` master, `⟳` ping, `□`, `×`); full, they are words |

Keep-warm times, on and off, for this session, this machine or the repository (`2h`, `30m --track 5m`, `off --session`, `clear --machine`, …) are `/ai-dlc:cache-keepalive-configure`'s, which the same module answers.

The team's keep-alive settings, in `.ai-dlc/cache-keepalive.json`, are created with `/ai-dlc:cache-keepalive-install`, brought up to date with `/ai-dlc:cache-keepalive-merge`, and shown and changed with `/ai-dlc:cache-keepalive-configure`.

If you are reading this in Claude Code, the module did not answer: the ai-dlc hooks module is not loaded (Claude Code older than 2.1.287, or the plugin's hooks are turned off). Tell the person that, point them to the keep-alive README in the plugin (`hooks/keepalive/README.md`), and do nothing else: never ping or change a setting yourself.
