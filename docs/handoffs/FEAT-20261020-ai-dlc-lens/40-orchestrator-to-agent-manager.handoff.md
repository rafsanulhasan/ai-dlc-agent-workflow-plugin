---
run: FEAT-20261020-ai-dlc-lens
step: 40
from: orchestrator
to: agent-manager
mode: subagent
kind: handoff (bug fixes from the human's live check after reload; low-budget mode 2bi)
date: 2026-10-25
branch: feat/ai-dlc-lens
---
# Fix three bugs the human saw live (after /reload-plugins, at 2800cb3/c986108)

Human: "when cache keepalive is off on master, the old statusline is still shown. it should be hidden. the /ai-dlc:cache-keepalive command should override the settings.local.json so that it applied in the local settings and takes precedence. the Cache Lens band is gone"

1. **Master off hides the status line.** With the keep-alive master off, show no keep-alive status line at all (the old one must not stay on screen). This replaces T17.6's choice "hidden only when no track is allowed" (38 hand-back). The band / Pane still shows the rows and buttons so it can be turned back on.
2. **`/ai-dlc:cache-keepalive` writes `.claude/settings.local.json`.** When the command changes keep-alive (on/off, master or a track), write the setting to the project's `.claude/settings.local.json` (the `env` `AI_DLC_KEEPALIVE_*` keys, or whatever key the precedence chain reads highest) so it applies locally and wins over `.claude/settings.json` and `.ai-dlc/cache-keepalive.json`. Keep the existing `--session` form session-only. Band / Pane buttons stay session-only (decision 2d) unless the code shares the path; say which.
3. **The band is gone.** After reload neither band may be missing: check the keep-alive band (T17.6, `hooks/keepalive/panel.tsx`, drawn from auto-handoff's AbovePrompt hook) and the AI-DLC Lens band (`plugins/claude/ai-dlc-lens/hooks/register.tsx` AbovePrompt hook). Find why one is not drawn (e.g. two AbovePrompt hooks where only one wins, a refused node like step 34, a guard), fix it so both show, and say the cause with path:line.

Rules as in step 38 (`38-orchestrator-to-agent-manager.handoff.md`, "Per task"): no new test suites, keep existing tests green, build-copilot then --check, one commit per fix (`fix(<area>): ... (step 40)` + Co-Authored-By line), don't push, no README edits (put a short Docs update line in the hand-back), never edit run.v4.md; `.ai-dlc/cache-keepalive.json` is the human's: read it, never write it. Ask the human nothing.

Hand back (short): line 1 `handoff <this record>: passed|failed — <why>`; one line per fix: commit, tests, cause/choice.
