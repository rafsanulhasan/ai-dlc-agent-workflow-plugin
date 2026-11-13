---
name: herdr-decisions
description: herdr skill (2026-11-12): watch/run-in-pane/off, fallback detection, result file main + pane copy fallback; bgIsolation none set by human
metadata:
  type: project
---

The human's decisions for the `herdr` skill (run AAWP-20261112-herdr-skill, closed 2026-11-12):
- Both modes behind a setting: `watch` (default), `run-in-pane`, `off`. A teammate idle or waiting for a handoff keeps its pane; panes close only when the agent is finished.
- Activation: automatic inside herdr; when `HERDR_ENV` is missing (it is, in this session's Bash), fall back to a unique working claude pane in this repo's cwd — never guess.
- Run-in-pane result: research picks main and fallback (result file main, base64 pane copy fallback); extra settings scope became ACs (AC-16..23).
- Our own skill, Claude Code only; own AAWP run, not the lens run.
- Background agents could not write to the shared checkout until the human set `worktree.bgIsolation: none` in `.claude/settings.local.json` (agents copy it into worktrees if they use one). Worktrees are created from `main`, not the current branch.

**Why:** these settle questions a future herdr change would otherwise re-ask.

**How to apply:** start from these when herdr work comes back; related: [[gpg-signed-commits]], [[review-budget]].
