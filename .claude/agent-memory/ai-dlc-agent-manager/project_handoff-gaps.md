---
name: handoff-gaps
description: Deferred backlog from the 2026-10-21 handoff-naming work — O5 session matching, stale local data, unverified Copilot nesting, untested main-agent rule
metadata:
  type: project
---

Deferred on 2026-10-21 (run AAW-20261021-handoff-naming), not done in that change:

1. **O5 — session matching for resume is undecided.** Candidate: compare the platform session id by exact equality; fall back to host + start time only when the platform gives no id. Needs the human's decision before the `handoff` skill's *Run state* is changed.
2. **Stale run data:** some run-state files from 2026-10-21 record the wrong `branch` or miss a Stages row for a stored hand-back. Check `docs/handoffs/*/run.md` against their folders and fix them in one change; machine-local settings that point at handoff folders are each developer's own to clean up.
3. **Copilot nesting unverified.** No GitHub doc says whether a custom agent can delegate to another; docs keep "on Copilot only the main agent spawns" until a test proves otherwise.
4. **Orchestrator main-agent rule at depth 3 is untested.** Claude Code allows nesting to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3 from v2.1.219); the rule now rests on the orchestrator being the human-facing lead plus limited depth. Do not drop it without a test run.

**Why:** kept out of scope to keep the naming change reviewable; each needs a human decision or a test.

**How to apply:** raise these when the human next touches handoff, run state, nesting or settings work. Related: [[handoff-naming]].
