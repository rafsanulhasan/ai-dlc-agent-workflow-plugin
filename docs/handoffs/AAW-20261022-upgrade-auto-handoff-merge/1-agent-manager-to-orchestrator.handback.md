---
run: AAW-20261022-upgrade-auto-handoff-merge
work-item: none
lifecycle: AAW
step: 1
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-22 17:27
---

handoff 1-orchestrator-to-agent-manager.handoff.md: passed — the brief was complete and unambiguous (one change to the workflow skill I own); I made it, ran every check listed, and committed nothing.

`/ai-dlc:workflow upgrade` now also brings an existing `.ai-dlc/auto-handoff.json` up to date, on Claude Code only. It never creates that file. All checks pass.

**What changed**
- **`workflow` skill, upgrade mode.** The intro now says upgrade brings every `.ai-dlc/` file up to date. A new step 6 handles the auto-handoff settings:
  - **On GitHub Copilot:** the step says it does not apply there (the automatic handoff is a Claude Code hooks module) and is skipped.
  - **When the file is missing:** upgrade does not create it. It says the automatic handoff then uses its other sources and defaults, and points to `/ai-dlc:configure-auto-handoff install`.
  - **When the file exists:** upgrade reads `${CLAUDE_SKILL_DIR}/../configure-auto-handoff/SKILL.md` and follows only step 1 of its install mode. That means `merge --dry-run`, show the `+` and `-` lines, then with the developer's consent run `merge` and then `validate`. It skips that mode's steps 2 and 3, so it sets no values and runs no rename check.
  - **Why the presence check matters:** `merge` creates the file when it is missing, so upgrade must check that the file exists before running it. The step says so explicitly.
- **Phase 0 of the workflow skill** now looks for `.ai-dlc/auto-handoff.json` on Claude Code.
- **The workflow skill's Report section** now lists what happened to that file (keys added and removed, merge declined, or no file).
- **`configure-auto-handoff` skill:** one sentence in its install mode says that `/ai-dlc:workflow upgrade` runs its step 1 on an existing file and never creates one.
- **`docs/plugins.md`:** the line about `/ai-dlc:workflow upgrade` now mentions the auto-handoff merge on Claude Code.
- **No code changes.** `workflow.mjs` was not touched, so no tests were added. `.ai-dlc/catalog.json` did not need regenerating, because no skill or agent was added or removed.
- **Files left alone:** `README.md`, the handoff skill's `SKILL.md` and the auto-handoff module, as the brief asked.

Changed paths:
- plugins/claude/ai-dlc/skills/workflow/SKILL.md — docs
- plugins/claude/ai-dlc/skills/configure-auto-handoff/SKILL.md — docs
- docs/plugins.md — docs
- plugins/copilot/ai-dlc/skills/workflow/SKILL.md — generated
- plugins/copilot/ai-dlc/skills/configure-auto-handoff/SKILL.md — generated

Intent: after a plugin update, `/ai-dlc:workflow upgrade` should keep every `.ai-dlc` file current. On Claude Code it now runs the same add/remove merge on an existing `.ai-dlc/auto-handoff.json` that `init` and `configure-auto-handoff install` run, without ever creating the file. On Copilot it says the step does not apply.

Checks:
- `node tools/build-copilot.mjs`: "Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 62 skills, 0 hook event(s), 1 Claude-only hooks module(s) left out; 2 file(s) updated, 0 removed." (exit 0)
- `node tools/build-copilot.mjs --check`: "Copilot plugin and generated sources are up to date." (exit 0)
- `node .ai-dlc/workflow.mjs validate`: ".ai-dlc\workflow.json: valid" (exit 0)
- `node --test "tests/**/*.test.mjs"`: 314 tests, 314 pass, 0 fail
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`: Validation passed
- `npx @anthropic-ai/claude-code plugin validate --strict .`: Validation passed
