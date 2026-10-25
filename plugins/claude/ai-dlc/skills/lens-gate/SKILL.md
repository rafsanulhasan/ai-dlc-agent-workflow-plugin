---
name: lens-gate
description: "Lens anomaly detection (blocked runs and steps, gates waiting or rejected, loops out of rounds, failed or stuck agents, failed hand-backs): on|off turns it on or off; bare, it lists them (needs the ai-dlc-lens plugin)."
argument-hint: "[on|off]"
disable-model-invocation: true
---

# Lens anomaly detection

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

In Claude Code the `ai-dlc-lens` plugin's hooks module answers `/ai-dlc:lens-gate` itself, before this text reaches the model:

| Command | What it does |
|---|---|
| `/ai-dlc:lens-gate` | Lists the anomalies found now, anything the lens could not read, and which runs it reads |
| `/ai-dlc:lens-gate on` | Turns detection on: sets `gateAlert` to `true` in `.ai-dlc/lens.json` |
| `/ai-dlc:lens-gate off` | Turns detection off: sets `gateAlert` to `false` |

Detection is on by default. The lens checks every run its agents' briefs name (the run's current run state, `run.v<version>.md` or a legacy `run.md`, and its handoff records and hand-backs) and every agent it tracks. With the setting `anomalyRunScope` set to `all` (`/ai-dlc:lens-configure anomalyRunScope all`; the default is `session`), it also checks the current run state of every run folder under the handoff folder (`artifacts.handoffs` of `.ai-dlc/workflow.json`, default `docs/handoffs/`) whose status is `active` or `blocked`. It checks on each Stop, at the end of each turn, when a run state or record is written, and every 2 seconds while agents work:

| Anomaly | Colour |
|---|---|
| A run is `blocked` (the anomaly names its blocked steps) | red |
| A step is `blocked` (its row in the run's *Stages* table), whatever the run's status; not repeated while the run's own anomaly is shown | red |
| A gate is waiting for the human | orange |
| A gate was rejected | red |
| A loop is out of rounds | deep orange |
| An agent failed or stopped | red |
| An agent was killed, or has been waiting too long | red |
| A hand-back failed its check | yellow |

Each anomaly gets one toast when it appears, never one per Stop, and leaves the list when its cause is gone. The lens marks the run, agent or arrow it concerns and lists it in an "Anomalies" section of the workflow view. Each check, its colour and the waiting threshold are lens settings; list them with `/ai-dlc:lens-configure`. It never blocks a stop.

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else.
