---
name: review-budget
description: User wants few review rounds (token cost); per-loop maxRounds/maxFailures default 2/1; env precedence settings.local > settings > workflow.json
metadata:
  type: feedback
---

The user finds repeated review/critique rounds token-expensive. Keep review rounds minimal and ask before adding an extra round.

**Why:** they raised "always 3 rounds of review and BC critique" as the problem. In the run that fixed it (2026-10-22) they chose a per-loop `maxRounds` / `maxFailures` with default 2 / 1 and the rule maxRounds ≥ maxFailures + 1. Env overrides resolve settings.local.json, then settings.json, then the process env, then workflow.json. When a step stops with findings open, the human decides: raise the limits for that run, or stop / accept.

**How to apply:**
- Take each loop's limits from `node .ai-dlc/workflow.mjs rounds --json` and never resolve them yourself.
- When the budget is spent, bring every open finding in one batched question.
- The user often directs the final round themselves, e.g. "fix all, one BC check, then close and commit", and accepts skipping code review for small code changes under a recorded one-off override.
- Minors need no decision. Record them as follow-ups and close.

Related: [[team-roster]]
