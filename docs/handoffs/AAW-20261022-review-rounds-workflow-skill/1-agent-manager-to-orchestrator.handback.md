---
run: AAW-20261022-review-rounds-workflow-skill
work-item: WI-1
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 05:40
---

handoff 1-orchestrator-to-agent-manager.handoff.md: passed — record exists, self-contained, every artifact path and line hint matched the files; tests import the template CLI (not `.ai-dlc/workflow.mjs`), so no clarify was needed.

## Summary
Review rounds are now a project setting in the `workflow` skill, default 1. All six required changes are done; nothing under `.ai-dlc/` or `.claude/settings.json` was touched, and nothing was committed. Build check passes. Tests: 202 of 203 pass; the 1 failure is `tests/workflow/handoff-naming.test.mjs` ".ai-dlc copies equal the templates", which compares the repo's own `.ai-dlc/` to the templates. It was **already failing before this change** — the human's uncommitted edits put `"maxRounds": 1` into `.ai-dlc/workflow.json` where the template had `3` (verified with `git show HEAD:…/workflow.json | diff - .ai-dlc/workflow.json`) — and it stays failing until WI-2 resyncs `.ai-dlc/` from the templates. It cannot be fixed in this item without touching `.ai-dlc/`, which the brief forbids.

## What changed
1. **Schema** (`templates/workflow.schema.json`): new `review.maxRounds` (integer ≥ 1; description gives what N means, the precedence, the env var, the `rounds` command and that `clarify` is not covered). `loop.maxRounds`: omitted → inherits `review.maxRounds` (default 1); no longer required on the AAW review loops, explicit values there must be equal. `review` description and the AAW wording in `routing.byType` updated to match.
2. **`templates/workflow.mjs`**: `review` allows `axes` and `maxRounds` (positive integer). AAW: "required" error removed; "explicit values must be equal" kept (a malformed value is still caught by the generic loop check). New `rounds [--json]` command — one row per stage loop, keyed `lifecycle/stage`, with agent, loop-back target, limit and source (`env` / `loop` / `review` / `default`); refuses an invalid workflow (exit 1), like `show`. `AI_DLC_REVIEW_ROUNDS` counts only when it is a whole number > 0; unset, empty or blank = not set, no warning; anything else is ignored with one stderr line `warning: AI_DLC_REVIEW_ROUNDS=<v> ignored: not a whole number > 0; using workflow.json`, in `validate`, `rounds` and also `show` (which now prints effective limits) — never an error, never a changed exit code. `show` prints `x<N>` on every loop and a "Review rounds: N (source)" summary line. `--help` lists `rounds`, `--json` and the precedence.
3. **`templates/workflow.json`**: `"maxRounds": 1` added to `review`; the three AAW `"maxRounds": 3` removed; the AAW note reworded for the new budget. Other loops untouched (they now inherit).
4. **Docs** (to the skill-management writing guide): `aaw-review.md` Budget and What `validate` enforces, plus a pointer to `rounds`; `edit-recipes.md` review-rounds recipe now covers all loops, a per-stage override with the AAW equality rule, and inheritance for "loop back … at most N times"; `SKILL.md` new *Review rounds* section (the precedence in prose), `rounds` in the CLI table, Mode: show and Report, the AAW guardrail line, and Mode: upgrade adds `review.maxRounds` when missing and offers to drop the old AAW `3`s (which otherwise keep winning). One addition beyond the brief: the skill's `description` frontmatter "refinement loops" → "refinement loops and their review rounds", so requests about rounds trigger it — revert if unwanted.
5. **Tests** (`tests/workflow/workflow.test.mjs`): the `cli()` helper now strips `AI_DLC_REVIEW_ROUNDS` from the inherited environment, so a shell value cannot change the results. Updated the "required on an AAW review loop" cases, the AAW `x3` show case, the unequal-budget and not-looping-back cases. Added: `review.maxRounds` rejects 0 / 1.5 / `"2"`, accepts 1, may be omitted; `rounds` table and JSON; precedence env > loop > review > 1; env overrides the AAW loops equally; unset / empty / blank env gives no warning; `0`, `-1`, `1.5`, `abc`, `2x`, `+2` each fall back with exactly one warning and exit 0, in both `rounds` and `validate`; a valid env does not make an invalid file pass; `rounds` refuses an invalid workflow; `show` prints `x<N>` on every loop and follows the env; `--help` lists `rounds`.
6. Copilot copy regenerated (`node tools/build-copilot.mjs`).

Extra check: the new CLI accepts the repo's current `.ai-dlc/workflow.json` (human edits, no `review.maxRounds`) as valid, and `rounds` shows the three AAW loops at 1, source `loop`.

Notes for WI-2: `SKILL.md` calls `review.maxRounds` "the project setting `/ai-dlc:init` writes" — today install copies the template, which already carries it; init's own wording is WI-2. The new template drops the AAW `3`s, so the repo's `.ai-dlc/` resync can drop the human's explicit AAW `1`s or keep them — both give 1.

Memory: saved one entry in my folder — `project_ai-dlc-copy-test.md` (+ its `MEMORY.md` line): the handoff-naming test fails until the repo's `.ai-dlc/` is resynced after any template change.

Changed paths:
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\templates\workflow.mjs — code
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\tests\workflow\workflow.test.mjs — code
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\templates\workflow.schema.json — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\templates\workflow.json — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\references\aaw-review.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\references\edit-recipes.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\workflow\SKILL.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\.claude\agent-memory\ai-dlc-agent-manager\project_ai-dlc-copy-test.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\.claude\agent-memory\ai-dlc-agent-manager\MEMORY.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\templates\workflow.mjs — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\templates\workflow.schema.json — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\templates\workflow.json — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\references\aaw-review.md — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\references\edit-recipes.md — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\workflow\SKILL.md — generated

Intent: Review rounds were 3 for AAW and unbounded everywhere else, which spends tokens. Every stage loop now has a limit that defaults to 1, resolved as env `AI_DLC_REVIEW_ROUNDS` (whole number > 0, else ignored with a warning) → the loop's `loop.maxRounds` → `review.maxRounds` → 1. The AAW review loops keep one shared budget, and a new `rounds` command shows each loop's limit and where it came from. This covers the `workflow` skill and its tests only; the consumers are WI-2.

Checks:
- `node tools/build-copilot.mjs` → "Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s), 1 Claude-only hooks module(s) left out; 6 file(s) updated, 0 removed."
- `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date." (exit 0)
- `node --test "tests/**/*.test.mjs"` → tests 203, pass 202, fail 1 — the failure is `tests\workflow\handoff-naming.test.mjs:44` ".ai-dlc copies equal the templates (line endings normalised)", pre-existing for the reason in the summary.
- `node plugins/claude/ai-dlc/skills/workflow/templates/workflow.mjs validate --file .ai-dlc/workflow.json --plugin plugins/claude/ai-dlc` → ".ai-dlc\workflow.json: valid"
- `AI_DLC_REVIEW_ROUNDS=abc … validate` on the template → one stderr warning line, "valid", exit 0.
