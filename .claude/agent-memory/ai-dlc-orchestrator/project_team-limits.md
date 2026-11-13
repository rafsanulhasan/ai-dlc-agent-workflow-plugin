---
name: team-limits
description: Agent-team limits seen live 2026-11-13 — research-assistant teammates have no web tools; nested spawns of teammates report to the lead; some teammates can't write their hand-back
metadata:
  type: project
---

Seen in the lens run on 2026-11-13 (Claude Code 2.1.323, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1):

- A `research-assistant` spawned as a **teammate** had no WebFetch, WebSearch or Bash; it spawned web-fetch helpers, and their reports were delivered to the **team lead**, not to the teammate ("the agent that spawned you is no longer running"). The lead had to relay every report.
- Some teammates (brutal-critique, code-reviewer) reported they could not write their hand-back file; the sender stored it verbatim, as the handoff skill allows.
- A `claude -p`-style permission refusal (curl, rm on a downloaded binary) is never routed around through another agent; agent-manager reading licences with git clone / gh api was allowed.

**Why:** three research teammates (ra-56a/b/c) failed or went partial for this reason; ITEM-119 tracks the agent-artifact fix.

**How to apply:** run web research as a plain `research-assistant` **subagent** (it reports to the lead directly and has its web tools), even inside a team round; keep teammates for the agents that hand work to each other. Brief teammates without Write to send their verdict to the sender, who stores it. Related: [[aawp-as-agent-team]], [[commits-by-devops]].
