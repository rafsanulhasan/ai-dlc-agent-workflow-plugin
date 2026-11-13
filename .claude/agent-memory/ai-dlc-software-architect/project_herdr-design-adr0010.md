---
name: herdr-design-adr0010
description: AAWP-20261112-herdr-skill design 1.1.4: ADR-0010 orchestrator drives herdr panes via one skill script (not a hook); next ADR 0011
metadata:
  type: project
---

Design 1.1.4 (2026-11-12) for herdr panes: ADR-0010 (Proposed) has the orchestrator call `skills/herdr/scripts/herdr.mjs` (detect/open/close/run). It is not a hook, because hook payloads lack the step code needed for the label, and a hook cannot replace a spawn. Run-in-pane reads the hand-back from a result file written by a `claude -p` wrapper, not from pane text. Mode 5 always uses watch. The setting is `.ai-dlc/herdr.json` (`mode`, `runTimeoutMinutes`) plus `AI_DLC_HERDR_*`. Research questions Q1-Q5 were open at hand-back.

**Why:** the human wants panes only inside herdr, with zero effect outside it. A pane is cosmetic and must never block.

**How to apply:** the next ADR is 0011. Worktree agents may start on a stale base: check that the commit named in the brief is HEAD before you start. Related: [[step44-band-and-pane-seats]].
