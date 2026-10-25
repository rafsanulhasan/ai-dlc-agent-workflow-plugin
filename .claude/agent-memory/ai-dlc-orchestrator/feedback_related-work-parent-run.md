---
name: related-work-parent-run
description: A follow-up request related to an active feature run joins that run as its next top-level steps (same folder, same flowchart); never open a new run for it
metadata:
  type: feedback
---

A request related to a feature that already has an active run (follow-up fixes, the reviews, a rule or doc change it triggered) joins that **parent run**: its work items continue the run's top-level step numbers (parent at step 4 → 5, 6, 7, 8), in the parent's handoff folder, so its agents land in the parent's lens flowchart. Only an unrelated request gets its own run. I judge related vs unrelated myself and ask the human one question when it isn't clear.

**Why:** the human (2026-10-23) saw lens work split across separate runs and flowcharts (I had opened AAW runs for the docs-status rule and the orchestrator verify-only rule while the lens run was going) and called it a bug. Three runs were merged into FEAT-20261020-ai-dlc-lens as steps 19–25. The rule is being written into the plugin as step 26 of that run.

**How to apply:** at Classify, before creating a run folder, check the active runs; if the request belongs to one, add steps to it (next top-level number) instead of a new run. Related to [[team-roster]] only in that the same roster applies.
