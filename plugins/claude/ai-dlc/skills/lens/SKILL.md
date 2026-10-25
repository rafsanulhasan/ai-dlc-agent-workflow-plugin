---
name: lens
description: "Opens or brings forward the AI-DLC Lens view, a live view of every run: one panel per workflow, its step charts of agents, and the avatar and hand-off panels (needs the ai-dlc-lens plugin). /ai-dlc:lens."
disable-model-invocation: true
---

# Lens

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

The lens is a separate plugin, `ai-dlc-lens`. In Claude Code its hooks module answers the lens commands itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens` | Opens the **AI-DLC Lens** view when it is closed and brings it forward when it is open; the view also opens on its own at the first spawn. Pinned to the band above the prompt (terminal, desktop), the band takes the full width, is drawn even with no workflow and starts minimised; it has a close (`×`) only while no workflow is in progress, and once closed it stays away until the next spawn or this command. Minimised, it is one line: the latest workflow in progress and how many are in progress, `(n)`; with none in progress the first waiting, then pending, then halted workflow; with none at all, "Nothing Here". Its `□` brings back its list and leaves the pane alone; its `⤢` (and a step chart's) opens the pane beside it on the latest workflow in progress (else the most recent), or switches it, and never hides the band. Each run of the command moves one step: a minimised band is restored to its list; then the pane opens beside the band on the latest workflow in progress (else the most recent) and the band is minimised; then a pane on an older workflow switches to that one; then, with the pane on it, the band is minimised and the pane stays open. Minimising the band never minimises or closes that pane. Docked, the view is a pane of its own, at its normal size, never the band's minimised size; while a workflow is in progress the band stays above the prompt too, at its own size. An "AI-DLC lens" card an older build left open is closed at load (a `/reload-plugins` included, at the band's first draw), at the first spawn and by the command |
| `/ai-dlc:lens-init [--force]` | Writes `.ai-dlc/lens.json` with every default, and its schema |
| `/ai-dlc:lens-configure [<key> [<value>\|--unset]]` | Shows the lens settings and where each comes from, or sets or unsets one |
| `/ai-dlc:lens-keepalive [on\|off]` | Shows or hides the Cache keep-alive section of the agent panes, and reports its figures |
| `/ai-dlc:lens-gate [on\|off]` | Turns anomaly detection on or off; bare, lists the anomalies |
| `/ai-dlc:lens-kit` | Opens the kit pane of manual checks K1 to K5 |

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never open a pane, write a settings file or draw the run yourself.
