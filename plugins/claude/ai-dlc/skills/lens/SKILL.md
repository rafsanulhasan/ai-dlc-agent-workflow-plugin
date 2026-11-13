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
| `/ai-dlc:lens` | Pinned to the band above the prompt (terminal, desktop): shows the band, minimised, and brings it back when its `×` closed it; it never opens or changes the pane, which opens from the band's `⤢`. Docked, or where no band is drawn (VS Code): opens the **AI-DLC Lens** pane, or brings it forward, on the newest workflow in progress, else on the list of runs. The view also opens on its own at the first spawn. The band and the pane each show the **list** of runs or one run's **workflow** (its anomalies, `< Runs`, status, name and metadata, then one accordion per step, highest first, each with `–` / `□` just left of its `⤢`). A wide band shows the list only: choosing a run opens it in the pane and the band stays on the list; a narrow band opens it in the band. On the band: `–` / `□` minimise or restore the band only (`□` back to the list); `⤢` opens the pane at once, on the list when the band is minimised or listing, on the band's run when it shows one; `↺` takes a band showing a run back to the list; `×` only while no workflow is in progress. On the pane beside the band: `–` / `□` change the band only (`□` to the list, never a run); no `⤢`; `↺`, only while the band is closed or not drawn, closes the pane and shows the band in the pane's mode. "Open flowchart" on a chat card opens the pane on that run with that card's step open. Avatars and arrows follow Panel Type (drill-in or tab); a drill-in pressed on a narrow band opens in the band, on a wide band in the pane, on the pane in the pane. Minimised, the band is one line: the latest workflow in progress and how many are in progress, `(n)`; with none in progress the first waiting, then pending, then halted workflow; with none at all, "Nothing Here". A run's status is its latest: a restarted step replaces the failed attempt, a run state or stage marked `done` counts as completed, and a run state another session writes shows within seconds. The keep-alive band of the `ai-dlc` plugin is a band of its own, after the lens band. An "AI-DLC lens" card an older build left open is closed at load, at the first spawn and by the command |
| `/ai-dlc:lens-init [--force]` | Writes `.ai-dlc/lens.json` with every default, and its schema |
| `/ai-dlc:lens-configure [<key> [<value>\|--unset]]` | Shows the lens settings and where each comes from, or sets or unsets one |
| `/ai-dlc:lens-keepalive [on\|off]` | Shows or hides keep-alive in Cache Lab, in the agent panel (the Master, 1h and 5m buttons and the Keep Alive sub-accordion), and reports its figures |
| `/ai-dlc:lens-gate [on\|off]` | Turns anomaly detection on or off; bare, lists the anomalies |
| `/ai-dlc:lens-kit` | Opens the kit pane of manual checks K1 to K5 |

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else: never open a pane, write a settings file or draw the run yourself.
