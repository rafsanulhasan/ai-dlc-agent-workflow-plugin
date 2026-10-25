---
name: team-mode-no-sendmessage
description: In this repo's "team mode" planning runs, teammates may or may not have SendMessage; check, then message or coordinate through records on disk
metadata:
  type: project
---

On 2026-10-24 (run FEAT-20261020-ai-dlc-lens, step 14.1.16), the requirement-analyst and product-owner were briefed as teammates but neither had SendMessage or a shell (no delete). After root 29 (same day, restart 14.1.16.l1) every teammate got SendMessage; replies arrive at the next tool round, so poll the run folder with a cheap Glob while waiting.

**Why:** the first session ran the "team" as spawned subagents, so team tools were absent; waiting for a message never ends.

**How to apply:** at start, check for SendMessage (ToolSearch `select:SendMessage`). If present, message teammates and still write every handoff / hand-back to disk (sender writes the handoff, receiver the hand-back). If absent, poll the run folder (Glob `14.1.16.*`) for the sender's handoff, write the hand-back to disk with intent questions in it, and report everything (including files you cannot delete) in the final report. Do not write files at guessed product-tree paths before `pm`'s epic slugs exist: check `docs/product/active/*/` and the brief first. Related: [[product-tree-layout]].
