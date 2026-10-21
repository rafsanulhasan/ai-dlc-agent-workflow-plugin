---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 1
from: research-assistant
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

handoff 1-orchestrator-to-research-assistant.handoff.md: failed — no Bash tool here, so `git log -S "agent-memory" -- .gitignore` could not run and the commit that added `.gitignore:8` is not located; all other questions answered.

GitignoreRules:
.gitignore:8 — `.claude/agent-memory/` — only ignore rule matching agent-memory (repo)
.git/info/exclude — no match — nothing excluded
.gitattributes — no match — no attributes rule

Writers:
plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:41 — save op writes `<agent>/<type>_<name>.md` — writes memory files, no gitignore
plugins/claude/ai-dlc/skills/agent-management/SKILL.md:56-59 — mkdir + MEMORY.md scaffold — per new agent
plugins/claude/ai-dlc/agents/agent-manager.md:168 — scaffold `.claude/agent-memory/<name>/MEMORY.md` — on agent create
plugins/claude/ai-dlc/agents/agent-manager.md:48 — writes user_persona-name.md + roster — on rename
plugins/claude/ai-dlc/skills/init/SKILL.md:98 — writes `user_persona-name.md` — on init rename
plugins/claude/ai-dlc/skills/init/SKILL.md:114 — writes orchestrator `project_team-roster.md` — always on init
plugins/claude/ai-dlc/skills/init/SKILL.md:28 — reads (overlays) persona memory — read only
Gitignore writers in init, manage-memory, workspace-folders, harness-sync, plugin-management: none (workspace-folders writes .gitignore for scratch/worktree roots only)

SaysLocal:
none — no plugin file says agent memory is local, per-machine or uncommitted
plugins/claude/ai-dlc/skills/plugin-management/SKILL.md:101 — settings.local.json gitignored — adjacent, not memory

SaysShared:
none — no plugin file says agent memory is committed or shared via VCS
tools/templates/AGENTS.template.md:59 — memory under .claude/agent-memory — path only, no VCS claim
plugins/claude/ai-dlc/skills/init/templates/AGENTS.md:343 — same text, generated copy — path only
plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:103 — backups kept under VCS — compress backups, not memory
tools/build-copilot.mjs:65 — PLATFORM_NOTE: memory in .claude/agent-memory on both platforms — Copilot path, no VCS claim

ContentRules:
plugins/claude/ai-dlc/skills/init/templates/AGENTS.md:344 — "Never store secrets" — generated from orchestrator memory protocol
plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:184-192 — What NOT to Save list — no secrets rule here
plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:171-180 — memory types incl. user — no privacy guidance for user type
plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:96 — secret-name patterns — compress refusal only, not save

Copilot: plugins/copilot/ai-dlc/skills/manage-memory/SKILL.md has the same .claude/agent-memory paths (lines 103 etc.); no Copilot gitignore rule exists.

totals: GitignoreRules 1 · Writers 7 · SaysLocal 0 (1 adjacent) · SaysShared 0 (4 path/adjacent) · ContentRules 4 · unlocated: commit that added `.gitignore:8`.

Open question for agent-manager or a re-run with Bash: `git log -S "agent-memory" --format='%h %s%n%b' -- .gitignore` to find the commit and its reason. Also, "memory is project-scope and shared via version control" appears in no repository file (it is only in the orchestrator's briefing), so it is not a repo contradiction.
