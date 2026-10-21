---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 2
from: orchestrator
to: agent-manager
mode: subagent
loop: none
verification: pending
date: 2026-10-21
---

# Handoff 2: orchestrator -> agent-manager

## Goal
The human (2026-10-21): agent memory under `.claude/agent-memory/` MUST be tracked by git, both in this plugin repository and in every target repository the plugin runs in. Today this repo ignores it, and nothing in the plugin makes sure target repos commit it.

## Facts
- Locate report: `docs/handoffs/AAW-20261021-track-agent-memory/1-research-assistant-to-orchestrator.handback.md` (step 1 was recorded in `.scratch/` before this run folder existed and moved in here).
- Orchestrator verified: `.gitignore:7-8` is `# agent memory belongs to target repositories, not the plugin repo` / `.claude/agent-memory/`, added by commit `606f96b` (2026-10-10, "Give agents persona names…": "Plugin repo ignores .claude/agent-memory/ and records the naming convention in its development rule"). The human's instruction now reverses that decision.
- `.claude/agent-memory/` currently holds: `ai-dlc-agent-manager`, `ai-dlc-brutal-critique`, `ai-dlc-code-reviewer`, `ai-dlc-devops-engineer`, `ai-dlc-orchestrator`, `ai-dlc-product-manager`, `ai-dlc-product-owner`, `ai-dlc-research-assistant`, `ai-dlc-software-architect`, `ai-dlc-sqa-engineer`, and a stray `orchestrator` folder (no `ai-dlc-` prefix).
- No plugin file writes a gitignore rule for agent memory; no plugin file says memory is committed either. The secrets rule exists only in the generated AGENTS.md memory protocol; `manage-memory` has no secrets/personal-data rule for saving.

## Work
1. **This repo:** remove the `.gitignore` ignore rule and its comment. Check `.claude/rules/plugin-development.md` for the "naming convention"/memory note that commit added, and align it.
2. **Target repos (plugin):**
   - `skills/init/SKILL.md`: add a step that makes sure `.claude/agent-memory/` is not ignored in the target repo (`git check-ignore -q .claude/agent-memory/<agent>/MEMORY.md`); if a rule ignores it, tell the human which file and line and remove/negate it with their consent; state that memory is committed with the repository.
   - `skills/manage-memory/SKILL.md`: state that memory files are committed and shared with everyone who clones the repo; add a save rule: never store secrets, credentials, tokens or personal data; `user`-type memories are visible to the whole team.
   - `tools/templates/AGENTS.template.md` memory protocol (and so the generated init template / root AGENTS.md): "committed with the repository; never store secrets or personal data".
   - Check `skills/workspace-folders`, `skills/harness-sync`, `skills/plugin-management` (the setup/docs of this repo) for anything that should mention it; update `plugin-management/SKILL.md` if it documents the repo's ignore rules — note plugin-management is a skill you own: if you need to change it, say so and stop; the orchestrator will brief a fresh agent-manager.
3. **Existing memory in this repo:** before it gets committed, scan every file under `.claude/agent-memory/` for secrets, tokens, credentials, personal data (emails, machine paths that identify a person beyond the repo path) and report each hit as path:line; do not delete or edit memory content yourself except to remove a secret. Report the stray `orchestrator/` folder (contents, whether it duplicates `ai-dlc-orchestrator/`) — do not delete it; the human decides.
4. Rebuild: `node tools/build-copilot.mjs`, `--check`; `node .ai-dlc/workflow.mjs validate`; `node --test`.

## Constraints
Language-agnostic; follow `.claude/rules/plugin-development.md`. Never hand-edit `plugins/copilot/**` or the generated init AGENTS.md. Do not write files under `docs/handoffs/`. Do not commit (the orchestrator commits at close).

## Deliverable
Line 1: `handoff 2-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`. Then changed paths each marked code/docs/generated with a <=10-word note, the secrets/personal-data scan result (path:line or "none"), the stray-folder report, intent in one sentence, and checks with real result lines. Next hop: orchestrator re-runs checks -> brutal-critique (docs, including the memory files that will be committed) / sqa-engineer -> code-reviewer (code).
