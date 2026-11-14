---
name: store-critic-handbacks
description: brutal-critique refuses to write its own hand-back file (read-only rule); the orchestrator stores it verbatim, and writes records with python using forward-slash or chr(92) paths
metadata:
  type: feedback
---

brutal-critique will not write its hand-back into the run folder, even when asked: its rules limit writes to its own memory. Store its report verbatim yourself as `<code>-brutal-critique-to-orchestrator.handback.md`. Other agents (product-manager, requirement-analyst) do write their own hand-back file when asked by message, which saves retyping long reports.

When writing records from a bash heredoc that runs python, never put Windows paths with `\a`, `\P` etc. inside non-raw python strings: `\a` became a BEL character and corrupted `personal\ai-dlc` twice (2026-11-14). Use forward slashes or raw strings, and grep the written path afterwards.

**Why:** 2026-11-14 preview2 feature 8 run — three critics refused, and two handoff records went out with a broken path before being caught.

**How to apply:** every gate-critique round; every scripted handoff write. Related: [[review-budget]].
