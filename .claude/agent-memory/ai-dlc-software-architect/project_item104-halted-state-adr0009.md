---
name: item104-halted-state-adr0009
description: ITEM-104 lens halted-state journey narrative and ADR-0009 (halt marks in the agentsA row, staged: pure planner interim, ITEM-106 target); next ADR 0010
metadata:
  type: project
---

ADR-0009 (2026-11-02) records the rule that a mark guarding an agent's status change lives in its row in `agentsA`, written by the same `update`. Its status is "Accepted, implementation pending ITEM-106". The interim is the pure `mergeAgentList` / `planDrops` in lens.ts (decision 17); the race stays a known limit until ITEM-106. The narrative is docs/architecture/narratives/ai-dlc-lens-halted-state.md. Next free ADR: 0010.

**Why:** the human wanted the journey (alternatives, who proposed each, the human's choices) in a narrative, not only an ADR (decision 19). He then had the ADR written now (decision 20) and described ITEM-106 in full in both files.

**How to apply:** when ITEM-106 lands, change ADR-0009's status to implemented and remove the interim known-limit text. Claim only that options were shown to the human when a decision record quotes the question; the orchestrator added the missing ones to records 49 and 50 as addenda. Related: [[step44-band-and-pane-seats]].
