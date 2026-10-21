---
work-item: AAW-20261021-model-policy
agent: agent-manager
stage: change
round: 1
lifecycle: AAW
received: 2026-10-21
---

AAW-20261021-model-policy: done. I changed three skill files and touched no agent files, no agent-invocation/SKILL.md, and did not run the build.

What changed:
- plugins/claude/ai-dlc/skills/agent-management/SKILL.md (create-agent, step 3): the old default `claude-sonnet-4-6` is replaced. The line now says `model` must be an alias, never a pinned id: `haiku`, `sonnet` (the default) or `opus`. `fable` is allowed but is never the default. Under it is a three-line rule for choosing:
  - `opus`: agents spawned rarely whose errors spread downstream (orchestration, architecture, requirements, agent authoring).
  - `sonnet`: build, test, review, critique and planning.
  - `haiku`: read-heavy lookup or mechanical work that is spawned often and checked by another agent.
- plugins/claude/ai-dlc/skills/plugin-management/SKILL.md:52: the aliases are now `haiku` / `sonnet` / `opus`, never a pinned id. The line points to the rule in agent-management (*Mode: create-agent*) instead of repeating it.
- plugins/claude/ai-dlc/skills/skill-management/SKILL.md:34: "model (default sonnet)" now reads "model (an alias, default `sonnet`, never a pinned id)", so it matches the other two.

Changed paths:
- plugins/claude/ai-dlc/skills/agent-management/SKILL.md — docs
- plugins/claude/ai-dlc/skills/plugin-management/SKILL.md — docs
- plugins/claude/ai-dlc/skills/skill-management/SKILL.md — docs
- Generated: none yet. The orchestrator's rebuild will update the matching skill files under plugins/copilot/ai-dlc/skills/ (agent-management, plugin-management, skill-management); each of those is `generated`.

Intent: Make the plugin's model policy consistent. Agents and skills use model aliases, never pinned ids; `sonnet` is the default and `fable` never is. New agents get a short rule for picking between opus, sonnet and haiku, based on how often they are spawned and how far their errors spread.

Checks:
- `grep -rnE "claude-(sonnet|opus|haiku)-[0-9]" plugins/claude/ai-dlc tools` found nothing, so no pinned model ids are left in the plugin source or tools.
- `git diff --stat`: my three skill files changed. The other changes in the tree (6 agent files and agent-invocation/SKILL.md) belong to the parallel agent-manager; I did not touch them.
- I did not run `node tools/build-copilot.mjs` or `--check`, as the brief asked. The Copilot tree stays stale until the orchestrator rebuilds after both changes are in.
- No manifest changes and no added or removed skills, so `plugin validate` is not needed. `node --test` is not needed either, because no script or test changed.
