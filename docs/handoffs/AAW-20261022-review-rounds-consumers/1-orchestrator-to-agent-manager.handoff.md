---
run: AAW-20261022-review-rounds-consumers
work-item: WI-2a
lifecycle: AAW
step: 1
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-22
---

# 1 orchestrator → agent-manager: make everything that uses the review limits follow the new `workflow` skill design, and resync the repo's `.ai-dlc/`

## Goal
WI-1 made review limits configurable in the `workflow` skill. Every other agent, skill and doc still describes the old model: an AAW shared budget of 3, unbounded loops, and "clarify default 3". This item brings those up to date, adds the `/ai-dlc:init` steps, and resyncs this repository's own `.ai-dlc/` so the test suite passes.

## The design (implemented in WI-1; the source of truth)
Read `plugins/claude/ai-dlc/skills/workflow/SKILL.md`, in particular *How the orchestrator applies it* and the precedence table, and `references/aaw-review.md`. In short:
- **Limits on each loop.** Every stage `loop`, and `clarify`, has `maxRounds` (≥1) and `maxFailures` (≥0), with `maxRounds >= maxFailures + 1`. Default 2 / 1. There is no AAW shared budget.
- **Failing verdict.** Whatever the loop's `on` names.
- **Env pairs.** Three pairs, matched by the loop's stage agent:
  - `AI_DLC_CRITIQUE_MAX_ROUNDS` / `AI_DLC_CRITIQUE_MAX_FAILURES` (brutal-critique)
  - `AI_DLC_TEST_MAX_ROUNDS` / `AI_DLC_TEST_MAX_FAILURES` (sqa-engineer)
  - `AI_DLC_CODE_REVIEW_MAX_ROUNDS` / `AI_DLC_CODE_REVIEW_MAX_FAILURES` (code-reviewer)
- **Precedence per value, highest first:**
  1. `env` in `.claude/settings.local.json`
  2. `env` in `.claude/settings.json`
  3. the process environment
  4. the loop's value
  5. the default

  An invalid value warns and falls through to the next level. On Copilot only the process environment applies.
- **The orchestrator runs `node .ai-dlc/workflow.mjs rounds --json`** at the start of a run and before each loop, uses its values, and never computes the precedence itself.
- **When a loop stops** (rounds or failures exhausted) with findings still open, the human is asked once per stopped step. The options are: raise that loop's limits for this run (a one-off override recorded in run.md), or stop / accept. A fix round counts against the limits. Findings never pass on without the human's decision.
- **`workflow.mjs merge --template <t> [--file <f>] [--dry-run]`** adds missing keys and never overwrites or deletes.

## Changes
1. **`plugins/claude/ai-dlc/agents/orchestrator.md`** (the build then regenerates `skills/init/templates/AGENTS.md`):
   - **Run Loop step 1:** run `rounds --json` and record each loop's limits in the run state.
   - **Project workflow → Execution:** a `loop` sends work back until its `on` clears or its `maxRounds` / `maxFailures` is reached; then the human decision above.
   - **DW↔BC critique at `critique`-marked stages:** bounded by the brutal-critique limits from `rounds`. That critique has no loop object; use the default 2 / 1, overridden by the critique env pair.
   - **AAW step 5 (Loop):** each reviewer has its own limits; there is no shared budget.
   - **Run Loop step 8:** `clarify.maxRounds` / `clarify.maxFailures` (default 2 / 1) instead of "default 3".
   - **Root `AGENTS.md`:** check whether the build regenerates it. If it does, rebuild. If it does not, update the matching text by hand so it equals the orchestrator body.
2. **`plugins/claude/ai-dlc/skills/init/SKILL.md`:**
   - **Phase 1:** one question for the review limits, the three reviewer pairs (default 2 / 1, `maxRounds >= maxFailures + 1`). Mention that each developer can override them in `.claude/settings.local.json` `env`, and the team in `.claude/settings.json` `env`.
   - **Phase 2:**
     - If `.ai-dlc/workflow.json` exists, run `merge --dry-run`, then `merge`; never replace it.
     - Write the answers into the `maxRounds` / `maxFailures` of every loop whose stage agent is that reviewer, after the copy or merge and before `validate`.
     - If `.claude/settings.json` exists, merge the template's settings into it, adding only missing keys. Never replace an existing value, and keep its comments, since the file can be JSONC.
   - Init does not write the env pairs; they are optional overrides.
3. **Prose that still states the old model:**
   - `skills/ai-dlc/SKILL.md`: ~:93 the shared budget; ~:125 Code Audit "until zero remain" is now bounded; ~:198 clarify "at most 3 rounds" becomes `clarify.maxRounds` / `maxFailures`.
   - `skills/agent-invocation/SKILL.md`: ~:97, ~:170-194 (clarify default 3).
   - `skills/request-routing/SKILL.md`: ~:41.
   - `skills/handoff/SKILL.md`: ~:245, the "round 1 / 3" example.
   - `README.md`: ~:58, "three rounds by default".
   - `docs/plugins.md`: ~:127, if it describes the old rule.
   - Grep `plugins/claude/ai-dlc` (outside `skills/workflow/` and `agents/agent-manager.md`) for "shared round budget", "maxRounds", "3 rounds", "default 3" and fix every hit.
4. **Resync this repository's `.ai-dlc/` (human decision: resync to the template).**
   - Copy `templates/workflow.json`, `templates/workflow.schema.json` and `templates/workflow.mjs` over `.ai-dlc/`. This replaces the human's uncommitted AAW `maxRounds: 1` edit; the human chose this.
   - Run the catalog check from `aaw-review.md` (regenerate to a temp file outside the repo, compare, delete). Regenerate `.ai-dlc/catalog.json` only if the check shows drift.
   - Run `node .ai-dlc/workflow.mjs validate`.
5. **Do not touch** `agents/agent-manager.md` (WI-2b, a fresh instance), `skills/workflow/` (WI-1, closed for edits), or `.claude/settings.json`.

## Checks to run
- `node tools/build-copilot.mjs`, then `--check`.
- `node --test "tests/**/*.test.mjs"`: **all** tests must pass now that `.ai-dlc/` is resynced.
- `node .ai-dlc/workflow.mjs validate` and `node .ai-dlc/workflow.mjs rounds`.
- The catalog check output.

## Suggested skills
- `workflow` (read only, for the design)
- `skill-management` (writing guide)
- `agent-management`

## Instructions for the receiver
- Line 1 of your report: `handoff 1-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`.
- End with **Changed paths** (each code / docs / generated), **Intent** and **Checks**, with real output.
- Do not commit.
- Review budget: 1 round. Docs go to brutal-critique.
