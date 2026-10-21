---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 2
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

handoff 2-orchestrator-to-agent-manager.handoff.md: passed — every Work item is done. Agent memory is now tracked in this repo (`git check-ignore` exits 1). `init` and `manage-memory` now make target repos commit it and keep secrets and personal data out of it. The memory scan found no secrets or personal data. All checks pass.

**What changed**
- This repo no longer ignores `.claude/agent-memory/`.
- `/ai-dlc:init` now checks that agent memory is not ignored and fixes the rule if one does, with the developer's consent:
  - Phase 0, step 7: runs `git check-ignore -v`.
  - Phase 1: shows the rule and proposes the fix.
  - Phase 2: done when `check-ignore` exits 1.
  - Phase 3: reports the result.
- **One fix in init that you should check:** git cannot re-include a path whose parent folder is ignored. A `.claude/` rule must become `.claude/*` before `!.claude/agent-memory/` takes effect. I tested this in a scratch repo (`.scratch/aaw-track-memory/t1`):
  - `.claude/` plus the negation → still ignored (exit 0)
  - `.claude/*` plus the negation → tracked (exit 1)
  - a rule for the memory folder in `.git/info/exclude` plus a negation in the repo `.gitignore` → tracked (exit 1)
  - `.claude/` in `.git/info/exclude` plus the same negation → still ignored (exit 0)
- `manage-memory` has a new section, "Committed with the repository":
  - memory is shared with everyone who clones the repo;
  - no secrets or personal data, with each kind listed;
  - `user` memories are read by the whole team.
  - The Save step now drops secrets and personal data and tells the caller what it dropped.
- `plugin-management`, `workspace-folders` and `harness-sync` needed no change. None of them mentions an ignore rule for agent memory.

**Changed paths**
- `.gitignore` — docs — removed the agent-memory ignore rule and its comment
- `.claude/rules/plugin-development.md` — docs — new line: memory committed, never ignored, check for secrets
- `AGENTS.md` — docs — memory protocol: committed, no secrets or personal data. Edited by hand in its managed block; it now matches the template.
- `tools/templates/AGENTS.template.md` — docs — the same memory protocol line, at the source
- `plugins/claude/ai-dlc/skills/init/SKILL.md` — docs — the agent-memory ignore check and fix (Phases 0, 1, 2 and 3)
- `plugins/claude/ai-dlc/skills/manage-memory/SKILL.md` — docs — the "Committed with the repository" section, the save check, the `user` type note, the What NOT to Save entry
- `.claude/agent-memory/ai-dlc-agent-manager/project_agent-memory-tracked.md` — docs — new memory: the decision and the open folder-name split
- `.claude/agent-memory/ai-dlc-agent-manager/MEMORY.md` — docs — index line for that memory
- `plugins/claude/ai-dlc/skills/init/templates/AGENTS.md` — generated — rebuilt from the template
- `plugins/copilot/ai-dlc/skills/init/SKILL.md` — generated — Copilot build
- `plugins/copilot/ai-dlc/skills/init/templates/AGENTS.md` — generated — Copilot build
- `plugins/copilot/ai-dlc/skills/manage-memory/SKILL.md` — generated — Copilot build
- **Now untracked and visible to git, for brutal-critique to review before commit:** all 13 files under `.claude/agent-memory/` (agent-manager 8, orchestrator 3, the stray `orchestrator/` folder 2). The other `ai-dlc-*` folders are empty.

**Secrets and personal-data scan**
- I searched every file under `.claude/agent-memory/` for:
  - passwords, tokens, API keys and private keys (`api[_-]?key`, secret, token, password, bearer, `BEGIN … PRIVATE`, `ghp_`, `github_pat_`, `sk-`, `AKIA`, `xox[bp]-`);
  - email addresses;
  - drive-letter, `/Users/` and `/home/` paths;
  - the user's name and account name.
- Result: none. The only hits are the word "secrets" in the policy text of my new memory, at `project_agent-memory-tracked.md:8` and `:14`.
- Manual read of all 13 files:
  - `ai-dlc-orchestrator/project_mods-release-scope.md:14` mentions `~/.claude/projects/<proj>/<session>/…`. It is a generic placeholder and names no person.
  - The persona names in the roster are public figures, used by design.
- I edited no existing memory content.

**The stray `orchestrator/` folder**
- It holds `MEMORY.md` (a `# Memory index` header and one entry) and `project_team-roster.md`: the 15-agent ID → name table, all default names, kept at init on 2026-10-14. The roster's frontmatter uses the old flat `type: project`, not `metadata.type`.
- It does **not** duplicate `ai-dlc-orchestrator/`. That folder holds different memories: `project_mods-release-scope.md` and `project_vscode-plugin-reload.md`.
- It is not really stray. Two writers name the orchestrator's memory folder differently:
  - `init/SKILL.md` (team names, Phase 2) writes the roster to `.claude/agent-memory/orchestrator/`, and `manage-memory` loads from `<agent-name>`, which is the agent ID.
  - Claude Code's native `memory: project` folder for the plugin agent is `ai-dlc-orchestrator/`.
- So orchestrator memory is split across two folders by design. The same split can happen for any agent renamed at init (`<agent>/user_persona-name.md` versus `ai-dlc-<agent>/`).
- I did not delete or change the folder. Which name wins is your decision; it is a separate change, which I recorded as open in my memory.

**Intent:** make `.claude/agent-memory/` tracked by git in the plugin repo and in every target repo the plugin is set up in, with a rule that memory never holds secrets or personal data.

**Checks** (real output)
- `git check-ignore -q .claude/agent-memory/orchestrator/MEMORY.md` → `check-ignore exit=1` (not ignored)
- `node tools/build-copilot.mjs` → `Copilot plugin written to plugins\copilot\ai-dlc: 15 agents, 61 skills, 0 hook event(s); 2 file(s) updated, 0 removed.`
- `node tools/build-copilot.mjs --check` → `Copilot plugin and generated sources are up to date.` / `check exit=0` (also re-run after the memory edits: exit 0)
- `node .ai-dlc/workflow.mjs validate` → `.ai-dlc\workflow.json: valid` / exit 0
- `node --test` → `tests 139`, `pass 139`, `fail 0` / exit 0
- `diff` of the root `AGENTS.md` memory-protocol block against the generated init template → `root AGENTS.md memory block matches template`
- I ran neither `plugin validate --strict` (no manifest changed and no agent or skill was added) nor `sync-harness.mjs --check` (that is for consumer repos).

**Not done, per the brief:** nothing written under `docs/handoffs/` and nothing committed. Next: the orchestrator re-runs the checks, then brutal-critique reviews the docs (including the 13 memory files to be committed). There is no code in this change, so sqa-engineer and code-reviewer have nothing to review.
