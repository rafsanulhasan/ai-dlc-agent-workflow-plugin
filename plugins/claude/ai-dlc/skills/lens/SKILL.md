---
name: lens
description: "Opens the AI-DLC lens pane, a live view of the run: the flowchart of agents, the main loop's thinking and gathered context, and the lens settings in force (needs the ai-dlc-lens plugin). /ai-dlc:lens."
disable-model-invocation: true
---

# Lens

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

The lens is a separate plugin, `ai-dlc-lens`. In Claude Code its hooks module answers the lens commands itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens` | Opens the lens pane: the flowchart of every agent, the main loop's thinking and gathered context, and the lens settings in force. The **AI-DLC workflow** pane opens on its own at the first spawn |
| `/ai-dlc:lens-init [--force]` | Writes `.ai-dlc/lens.json` with every default, and its schema |
| `/ai-dlc:lens-configure [<key> [<value>\|--unset]]` | Shows the lens settings and where each comes from, or sets or unsets one |
| `/ai-dlc:lens-keepalive [on\|off]` | Shows or hides the Cache keep-alive section of the agent panes, and reports its figures |
| `/ai-dlc:lens-gate [on\|off]` | Turns anomaly detection on or off; bare, lists the anomalies |
| `/ai-dlc:lens-kit` | Opens the kit pane of manual checks K1 to K5 |

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never open a pane, write a settings file or draw the run yourself.
