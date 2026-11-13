---
run: FEAT-20261020-ai-dlc-lens
step: 37
from: orchestrator
to: agent-manager
mode: subagent
kind: handoff (wave E1 build, low-budget mode, run.v4.md 2bh-2bi)
date: 2026-10-25
branch: feat/ai-dlc-lens
---
# Build wave E1 (plan docs/plans/tier-1-sprint-1.tasks.md §12.3)

Human: implement as far as you can, follow the plan, ask the human nothing. No sqa, code review, critique, architect or system-engineer rounds. Keep everything short.

Order (one task at a time): LENS T22.a (069), T22.b (070), T22.c (071), T22.d (072), T22.e (073), T22.f (074); KA T17.3 (034, includes the Windows `tail` fix, 2w/2al), T17.6 (068), T17.7 (076); LENS T22.g (077); KA T17.5 (036); then root 20: T20.3b (053.b), T20.3c (053.c), T20.6 (056, 053 part only). Skip T17.3c (needs human point H1, 2026-10-29) and anything else that needs a human; note it and go on. Specs: the task's entry in the plan, the stories/spec/LLD it cites. Where they leave a choice, pick the simplest that fits and note it.

Per task: build; write no new test suites, but keep the existing tests green (run the suite of the plugin you changed once: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` or `./plugins/claude/ai-dlc-lens`, or `node --test "tests/**/*.test.mjs"`); `node tools/build-copilot.mjs` then `--check`; then commit that task alone (`git add` only its files; message `feat(<area>): <task> <one line> (step 37)` with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Don't push. Don't edit READMEs or docs/plugins.md (docs are deferred); MANUAL-CHECKS.md and skill text are fine. Never edit run.v4.md or `.ai-dlc/cache-keepalive.json`; record changes in ATTRIBUTION.md as the hooks rules say.

Hand back (final message, short): line 1 `handoff <this record>: passed|failed — <why>`; then one line per task: id, commit hash, test result (pass/fail counts), choices made or why skipped. Stop when out of tasks or context; say where you stopped.
