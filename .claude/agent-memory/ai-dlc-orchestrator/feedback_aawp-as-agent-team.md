---
name: aawp-as-agent-team
description: Run every AAWP chain (agent-manager → brutal-critique / sqa-engineer → code-reviewer ×2) as a peer-to-peer agent team, never as a lone subagent
metadata:
  type: feedback
---

Run AAWP stages as a Claude Code agent team (request-routing Mode 5): spawn agent-manager, brutal-critique, sqa-engineer and both code-reviewer axes as named teammates together; they write their own handoffs and hand-backs, message each other by name, and report record names to the lead. Spawn the code-path teammates too and let agent-manager say "no code" when there is none.

**Why:** 2026-11-13, the human stopped a lone `agent-manager` subagent spawn for an ITEM-056 fix round: "you need to spawn the AAWP with agent teams for peer to peer communication". Earlier the same day they asked for a peer-to-peer team for the ITEM-107 review round.

**How to apply:** any AAWP change or fix round, inside a run or on its own, when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (on Copilot, or with teams off, fall back to subagents and say so). Planning and research steps may stay subagents. Inside herdr, open a watch pane per teammate; close it only after a confirmed shutdown, or once the teammate is no longer reachable by name. Related: [[review-budget]], [[herdr-decisions]].
