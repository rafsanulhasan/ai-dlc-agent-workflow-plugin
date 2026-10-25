---
name: lens-keepalive
description: "Shows or hides the lens's Cache keep-alive section (how long keep-alive kept the cache warm per track, what cache reads saved), then reports those figures (needs the ai-dlc-lens plugin; on by default). /ai-dlc:lens-keepalive [on|off]."
argument-hint: "[on|off]"
disable-model-invocation: true
---

# Lens keep-alive section

**Claude Code only.** On GitHub Copilot there is no lens and no keep-alive: say that this command does not apply there and stop.

In Claude Code the `ai-dlc-lens` plugin's hooks module answers `/ai-dlc:lens-keepalive` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens-keepalive` | Hides the section when it is shown, and shows it when it is hidden |
| `/ai-dlc:lens-keepalive on`, `/ai-dlc:lens-keepalive off` | Shows or hides it |

It writes the lens setting `keepaliveSection` (on by default) to `.ai-dlc/lens.json` and names the level that still wins when `AI_DLC_LENS_KEEPALIVE_SECTION` in the `env` of a settings file holds it. Then it reports the figures: the time kept warm per track, and the session's savings.

The section sits in every agent pane, after Usage, and starts collapsed like every section:

- **Kept warm, 5m track** and **1h track**: for each time keep-alive armed the track, from the arming to the cache's expiry, moved on by each ping; the cache's own TTL is included. The arming times, expiries and pings come from the state the `ai-dlc` plugin's keep-alive publishes; without `ai-dlc`, or with keep-alive off, both read `0s`.
- **Saved by cache reads**, for the agent and for the session: cache-read tokens times the input price minus the cache-read price, priced from the model metadata file the lens reads (`costingPath`, default `.ai-dlc/model-metadata.json`). A missing price shows `—`; a figure is never estimated. The premium paid to write the cache is not taken off.

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never change a settings file or ping the cache yourself (`/ai-dlc:cache-keepalive` pings).
