---
name: lens-kit
description: "Opens the lens kit pane: the manual checks K1 to K5 of the lens (resize across the dock boundary, Svg animation, pane buttons, transcript cards; K5 superseded: see /ai-dlc:lens-gate) (needs the ai-dlc-lens plugin). /ai-dlc:lens-kit."
disable-model-invocation: true
---

# Lens kit

**Claude Code only.** On GitHub Copilot there is no lens: say that this command does not apply there and stop.

In Claude Code the `ai-dlc-lens` plugin's hooks module answers `/ai-dlc:lens-kit` itself, before this text reaches the model: it opens the **AI-DLC lens kit** pane, which draws the five checks the lens's `MANUAL-CHECKS.md` runs by hand (K1 resize, K2 Svg animation, K3 pane buttons, K4 transcript cards; K5, the old gate alert, is superseded: see `/ai-dlc:lens-gate`, now anomaly detection).

If you are reading this in Claude Code, the lens did not answer: the `ai-dlc-lens` plugin is not installed or is turned off, or Claude Code is too old to load its hooks module. Tell the person that, and that it installs from the `ai-dlc-agent-workflow` marketplace with `claude plugin install ai-dlc-lens@ai-dlc-agent-workflow`, then `/reload-plugins`. Do nothing else.
