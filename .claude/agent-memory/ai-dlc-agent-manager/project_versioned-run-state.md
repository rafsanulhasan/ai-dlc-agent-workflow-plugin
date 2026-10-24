---
name: versioned-run-state
description: Run state is run.v<N>.md, one version per session (auto-handoff chain = one session); rule in handoff skill; hooks module reads the current version since step 11.6
metadata:
  type: project
---

Since 2026-10-24 (human, run FEAT-20261020-ai-dlc-lens step 11.3) a run's state is `run.v1.md`, `run.v2.md`…, one per session; an automatic-handoff chain counts as its parent session; older versions are never overwritten or deleted, only marked `status: deprecated` + `superseded-by:`. A legacy `run.md` is renamed to `run.v1.md` (`git mv`) by the next session that writes it.

Step 11.11 (human, 2026-10-24): versions are run.v<major>[.<minor>].md, no part 0, no leading zeros; change of direction = minor pair (.1 `pair: deprecated` with *Deprecated* section, .2 `pair: change`), new request scope = next major; current = highest (v2 > v1.2 > v1.1 > v1). No more front-matter deprecation.

Step 11.18 (human, 2026-10-24): plain continuation = owner (writer session + its auto-handoff chain) updates in place, any other session writes the next single minor (no `pair`); scope + direction together = minor pair first, then next major from the pair's second file (v1 → v1.1 + v1.2 → v2, v2 current). `-to-human` handoffs inside a phase are never "unanswered" work.

**Why:** the human wanted no session to replace another's run state.

**How to apply:** the rule lives once in the handoff skill (*Run state*, Versions); elsewhere write "the run state", not `run.md`. Since step 11.6 (2026-10-24) the auto-handoff module picks the current version with `run.ts` `currentRunStateFile` and writes *Next action* into it, never a new version; the lens is handled separately. See [[handoff-naming]].
