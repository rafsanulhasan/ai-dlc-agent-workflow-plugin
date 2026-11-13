---
step: 50
from: human
to: orchestrator
run: FEAT-20261020-ai-dlc-lens
date: 2026-11-01
---

Human's answers (AskUserQuestion, 2026-11-01), after code review round 1 of 2 of the halted-state fix (44.4.1.l3.1, 44.4.2.l3.1):

- **Decision 16 (dropped subagent, W1):** a time-based fallback. A subagent that is missing from the engine's agent list and has sent no events for the timeout shows halted. The timer counts only while the agent is missing from the list; an agent the engine still lists as running is never timed out. The timeout is configurable. Default proposed by the orchestrator: 15 minutes (the human may change it).
- **Fix round:** W1 to W3 and all 9 suggestions of round 1 go in one round, then code review round 2 of 2, then G4.

## Addendum (orchestrator, 2026-11-02): the questions as they were put
1. "W1: a subagent that really failed and is then dropped from the engine's agent list now shows 'in progress' forever. What should the lens do?" Options: "Dropped = ended (Recommended)" — a running agent that disappears from the list is treated as ended, no timer; "Time-based fallback" — after N minutes with no events, show it halted (risk named: a slow, silent agent marked halted, the original bug); "Accept the limit" — documented, M35 decides later. The human chose "Time-based fallback".
2. Follow-up: "after how long?" (15 / 30 / 10 minutes offered) — the human answered "make it configurable"; "when should the timer apply?" — options "Only if dropped from list (Recommended)" or "Always"; the human chose "Only if dropped from list". The 15-minute default is the orchestrator's proposal.
3. "Fix round: what goes in?" Options "Warnings + suggestions (Recommended)" or "Warnings only"; the human chose "Warnings + suggestions".
