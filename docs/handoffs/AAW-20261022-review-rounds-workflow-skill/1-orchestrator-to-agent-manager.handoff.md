---
run: AAW-20261022-review-rounds-workflow-skill
work-item: WI-1
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

# 1 orchestrator → agent-manager: configurable review rounds in the `workflow` skill

## Goal
At the moment AAW always runs up to 3 review rounds, and every other review loop has no limit at all. That spends a lot of tokens. Make the number of review rounds a project setting that `/ai-dlc:init` writes, that an environment variable can override, and that defaults to **1**. This item covers only the `workflow` skill and its tests. Consumers (orchestrator, init, ai-dlc, agent-invocation, request-routing, README) are WI-2, in a separate run. This is a change to a skill agent-manager owns, so you are a fresh instance and this brief is the whole task.

## Decisions (made by the human; binding)
- **Scope:** all review loops (every `loop` in the workflow file, AAW and non-AAW). `clarify.maxRounds` is **not** covered: clarify is Q&A, not review.
- **Default:** 1 round.
- **Setting:** the optional `review.maxRounds` (integer ≥ 1) in the existing `review` section of `workflow.json`, next to `axes`. Treated as 1 when absent.
- **Precedence for each loop's effective limit:** env `AI_DLC_REVIEW_ROUNDS` → the loop's own `loop.maxRounds` → `review.maxRounds` → 1.
- **Env var handling:** used only when its value is a whole number > 0 (e.g. `2`). If it is unset, empty, `0`, negative, a decimal (`1.5`), or not a number (`abc`), it is **ignored** and the JSON value applies. When it is set but invalid, `rounds` and `validate` print one warning line, e.g. `AI_DLC_REVIEW_ROUNDS=<value> ignored: not a whole number > 0; using workflow.json`. It is **never an error**, and the exit code is unaffected.
- **Meaning of N** (unchanged from `aaw-review.md`): 1 review plus up to N−1 fix-and-recheck passes. When findings are still open after the last round, the run stops and the human decides.
- **AAW shared budget stays.** The three AAW review loops (critique, test, code-review) no longer *require* `maxRounds`; they inherit it. Any explicit values must still be equal (keep that check). The env var overrides all three equally.

## Artifacts (verified to exist by the orchestrator)
All paths are under `plugins/claude/ai-dlc/skills/workflow/`.
- `templates/workflow.schema.json`
  - `review` section ~:140-153 (additionalProperties false, only `axes`)
  - `loop.maxRounds` ~:267-270
  - AAW wording ~:71
- `templates/workflow.mjs`
  - `TOP` ~:135
  - generic loop check ~:266-271
  - AAW required / equal checks ~:343-352
  - clarify ~:366
  - `review` keys ~:392
  - `show` output ~:456/:467
  - argv-only `process` use ~:28-40
- `templates/workflow.json`
  - AAW `"maxRounds": 3` at ~:440, :453, :466
  - `review` ~:584-586
- `references/aaw-review.md` (Rounds / Budget / Findings ~:31-44)
- `references/edit-recipes.md` (~:15, :18, :23, :31)
- `SKILL.md` (~:36; Mode: install / upgrade ~:64-91)
- Tests: `tests/workflow/workflow.test.mjs`
  - AAW maxRounds cases ~:338-344, :452-477, :589-623, :739
  - mermaid ~:388

## Required changes
1. **Schema:**
   - add `review.maxRounds` (integer, minimum 1, description gives the precedence and the env var)
   - `loop.maxRounds` description: omitted → inherits `review.maxRounds` (default 1); no longer required on AAW review loops; explicit values on the AAW review loops must be equal
2. **`workflow.mjs`:**
   - `review` allows `axes` and `maxRounds`; validate `maxRounds` as a positive integer
   - AAW: drop "required"; keep "explicit values must be equal"
   - new subcommand `rounds [--json]`: for every lifecycle stage with a `loop`, print lifecycle, stage, agent, effective limit and source (`env` / `loop` / `review` / `default`)
   - parse `AI_DLC_REVIEW_ROUNDS` as above, with the warning on stderr, in both `rounds` and `validate`
   - `show` prints the effective `x<N>` for every loop (it prints it only when set today)
   - add `rounds` to the help/usage text
3. **`workflow.json` template:**
   - add `"maxRounds": 1` to `review`
   - remove the three explicit AAW `"maxRounds": 3`
   - leave the uncapped loops without `maxRounds` (they now inherit)
4. **Docs:**
   - `aaw-review.md` (Rounds / Budget): where the budget comes from, the precedence, the env var
   - `edit-recipes.md`: "more / fewer review rounds" → set `review.maxRounds` (or `AI_DLC_REVIEW_ROUNDS` per session); per-loop override; AAW equality
   - `SKILL.md`: the setting, the precedence and the env var in the overview; the `rounds` command; Mode: upgrade adds `review.maxRounds` when missing and offers to drop the old explicit AAW `3`s, which otherwise keep winning over `review.maxRounds`
   - Follow the skill-management writing guide.
5. **Tests** (`node:test` / `node:assert` only, in `tests/workflow/`):
   - update the cases that expect "required on an AAW review loop"
   - add cases:
     - `review.maxRounds` 0 / 1.5 / string rejected, 1 accepted
     - `rounds` precedence: env > loop > review > default 1
     - env unset / empty / `0` / `-1` / `1.5` / `abc`: falls back with a warning (warning only when set), exit 0
     - env overrides the AAW loops equally
     - `validate` does not fail on a bad env value
6. Run `node tools/build-copilot.mjs`, then `--check`, and `node --test "tests/**/*.test.mjs"` (glob quoted).

## Out of scope (WI-2, do not edit)
- `agents/orchestrator.md`, `agents/agent-manager.md`
- `skills/init/`, `skills/ai-dlc/`, `skills/agent-invocation/`, `skills/request-routing/`
- `README.md`, `AGENTS.md`
- the repo's own `.ai-dlc/workflow.json` (it has uncommitted human edits setting the AAW loops to 1; do not touch it)
- `.claude/settings.json` (it has uncommitted human edits; do not touch it)

## Open questions / risks for the receiver
- `.ai-dlc/workflow.mjs` in the repo root is the installed copy of the template. Do **not** update it here; WI-2 handles this repository's own `.ai-dlc/`. If the tests import from the template path, fine; if they import `.ai-dlc/workflow.mjs`, report it as a clarify.
- The ids for the non-AAW loops in `rounds` output: use `lifecycle/stage`.

## Suggested skills
- `workflow` — the skill being changed; its file layout and modes
- `skill-management` — writing guide and review checklist for the docs

## Instructions for the receiver
Make the changes above in `plugins/claude/ai-dlc/skills/workflow/` and `tests/workflow/`. End your report with:
- **Changed paths**, each marked `code` or `docs`
- **Intent** (one paragraph)
- **Checks** you ran, with real output: build `--check` and the test totals

Next hop: brutal-critique (docs) and sqa-engineer → code-reviewer (code). Review budget for this run: **1 round** (the repo's current `.ai-dlc/workflow.json`).
