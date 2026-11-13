---
name: commits-by-devops
description: Only devops-engineer (Gene Kim) commits; the orchestrator never runs git commit, and other agents are briefed not to commit
metadata:
  type: feedback
---

The orchestrator never commits. Every commit (gate commits, run-close commits, records, run states, fixes) is made by `devops-engineer` (Gene Kim). The orchestrator briefs it with a handoff record: the exact paths to stage (its own paths only, never the hook-written `.ai-dlc/model-metadata.json`), the message with the attribution lines, and the run's records; then checks the reported hash, `git log` and `git status`. Other agents keep "do not commit" in their briefs.

**Why:** 2026-11-13, the human: "you should not commit anything. gene kil should" — after the orchestrator committed 47a3480 itself and planned more commits for the lens run.

**How to apply:** wherever the Run Loop or `handoff` says "commit the run state", spawn devops-engineer instead (a hand-off of the run: a gate record's commit takes the gate's step; otherwise the next free root). Signing rules still hold: [[gpg-signed-commits]] (tell the human when pinentry waits; never disable signing).
