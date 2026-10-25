---
name: pause-after-reload-request
description: After asking the human to /reload-plugins (or restart), start no further stage or spawn until they report back on the reload
metadata:
  type: feedback
---

When I ask the human to run `/reload-plugins` (or to restart the session) so they can see a change live, I pause: no next stage, no new spawn, no follow-up amendment sent to an agent, until the human reports back what they saw after the reload. Then I continue from their report.

**Why:** 2026-10-25, FEAT ai-dlc-lens step 36: the human reloaded while an agent-manager was still editing the lens, so the live check ran against half-built code and the next work went on without their report. The human said the work should have paused until they reported on the reload.

**How to apply:** End the turn with the reload request as the only next action, and say I'm waiting for their report. Record the pause in the run state's *Next action* ("waiting for the human's report after /reload-plugins"). Only ask for a reload once the change is finished (reviewed and committed, or at least no agent is still editing the files). If an agent is still running when a reload comes up, say so and let it finish before asking. Related: [[project_vscode-plugin-reload]].
