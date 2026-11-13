---
step: 52
from: human
to: orchestrator
run: FEAT-20261020-ai-dlc-lens
date: 2026-11-02
---

Human's answers (AskUserQuestion, 2026-11-02), after the design hand-backs 44.1.l2.2 (software-architect, system-engineer):

- **Decision 17 (ITEM-104 design, staged):** system-engineer's narrow design now, in ITEM-104: the refreshList updater body moves into pure functions in hooks/lens.ts (`mergeAgentList`, `planDrops`, taking the time `t` as input; `t` replaces `nowMs()` in the updater's stamp), unit-tested by calling them twice on the same frozen input. The race stays a documented known limit. software-architect's design (the halt marks move onto each agent's row in agentsA, written by the same update; shape agents-4; ADR-0009) becomes a follow-up backlog item; ADR-0009 is written when that item is taken up.
- **Decision 18 (mutant M10):** sqa-engineer tries a timing test for the `heard` call at turn.start; if it cannot show a difference, agent-manager removes that call as dead code. The `failed` guard in `heard` (mutant M16, unreachable) is removed as system-engineer recommends.
