---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 4
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

handoff 4-orchestrator-to-agent-manager.handoff.md: passed — the brief was self-contained and limited to my own files. Both files now use the one-memory-folder rule, and the Copilot build check passes.

What changed:
- **`plugins/claude/ai-dlc/agents/agent-manager.md`**
  - *Protocols* (was line 168): the memory scaffold line now states the folder rule. Each agent has exactly one memory folder under `.claude/agent-memory/`, the same on every platform. It is named like Claude Code's native `memory: project` folder: the agent's Claude Code id with `:` replaced by `-`. Plugin agents use `ai-dlc-<agent>` (for example `ai-dlc-orchestrator`); project-local agents use `<agent>`. The line also points once to `manage-memory`, "Committed with the repository" (memory is committed, so it never holds secrets or personal data).
  - *Rename agents* (line 48): `user_persona-name.md` is now written in that agent's memory folder and `project_team-roster.md` in the orchestrator's, with folder names taken from *Protocols*. The old bare `.claude/agent-memory/<agent>/` path is gone.
- **`plugins/claude/ai-dlc/skills/agent-management/SKILL.md`** (steps 6–7, was lines 56–59)
  - Step 6 states the same rule. The project-local agent this mode creates gets `.claude/agent-memory/<name>/`; a plugin agent gets `.claude/agent-memory/ai-dlc-<name>/`. It also says never to create a second folder for the same agent.
  - Step 7 writes `MEMORY.md` in that folder and carries the same pointer.

I did not touch `init`, `manage-memory`, the memory files or `docs/handoffs/`, and I did not commit. The IDE showed markdownlint warnings in `agent-manager.md` (MD040 at lines 54–155, MD060 at line 214). None are on the lines I edited.

Changed paths:
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\agents\agent-manager.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\agent-management\SKILL.md — docs
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\agents\agent-manager.agent.md — generated
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\copilot\ai-dlc\skills\agent-management\SKILL.md — generated

Intent: Apply the human's 2026-10-21 decision to agent-manager's own definition and its `agent-management` skill. Each agent gets exactly one memory folder, named like Claude Code's native `memory: project` folder (`ai-dlc-<agent>` for plugin agents, `<agent>` for project-local ones), the same on Copilot. This stops memory being split between the bare-ID folder and the native folder, and points to manage-memory's "Committed with the repository" rule.

Checks:
- `node tools/build-copilot.mjs` → `Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s); 2 file(s) updated, 0 removed.` (exit 0)
- `node tools/build-copilot.mjs --check` → `Copilot plugin and generated sources are up to date.` (exit 0)
- No manifest changed and no agent or skill was added or removed, so `plugin validate` and `node --test` were not needed.
