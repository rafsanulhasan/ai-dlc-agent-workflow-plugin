---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 3
from: brutal-critique
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21
---

handoff 3-orchestrator-to-brutal-critique.handoff.md: passed — brief read and all listed paths and all 13 memory files reviewed. Findings below. Two are Major (init edge cases), none is a Blocker. Verdict PASS.

# Critique: agent-memory tracking change (AAW-20261021-track-agent-memory, round 1)

Verdict: PASS

## Blockers
None. The 13 memory files hold no secrets, credentials, email addresses or personal data.

## Major
1. `plugins/claude/ai-dlc/skills/init/SKILL.md:49` — "add `!.claude/agent-memory/` to the repository `.gitignore`, which takes precedence" is only true for the root `.gitignore`.
   - A nested `.gitignore` (for example `.claude/.gitignore`) beats the root file, so the negation would silently fail.
   - Line 29 and line 47 list "a `.gitignore` in the repository" without saying it can be nested.
   - Fix:
     - Phase 0 step 7 records the exact file from `check-ignore -v`, which already does this.
     - Line 48 should say "the `.gitignore` that `check-ignore -v` names", not the root one.
     - Line 49 should say the negation goes in the root file only when no deeper `.gitignore` carries the rule.
   - Related: Phase 2 (line 87) accepts "exits 1" as done, so a failing negation would be caught after the write. Add "re-run `check-ignore`; if still 0, revert and report" so the failure is explicit.
2. `plugins/claude/ai-dlc/skills/init/SKILL.md:48` — the `.claude/` → `.claude/*` rewrite covers only the literal `.claude/`.
   - Not covered: `.claude`, `/.claude/`, `**/.claude/`, `.claude/**`. A `.claude/**` rule also blocks re-inclusion.
   - The line says "such as", so an agent has to guess. The handback tested only the literal case.
   - Fix: name the cases, or state the rule: "any pattern that ignores `.claude` itself or a directory containing the memory folder gets rewritten to ignore its children, then add the negation". Then require a post-write `check-ignore` re-run.
3. `plugins/claude/ai-dlc/skills/init/SKILL.md:46` vs `:56` vs `:87` — the consent mechanism is ambiguous.
   - Line 46 says the fix is "applied only with the developer's consent".
   - Line 56 says "Ask once for corrections, then proceed", which makes silence mean consent.
   - Line 87 says "the fix the developer agreed to".
   - Rewriting a developer's `.gitignore` line is more invasive than the other Phase 1 items. Fix: make it an explicit yes/no in Phase 1, defaulting to "no change, report" unless the developer says yes.

## Minor
1. `plugins/claude/ai-dlc/skills/init/SKILL.md:29` — Phase 0 does not say what to do outside a git repository, where `git check-ignore` errors with exit 128. Treat exit 128 as "not a git repository, skip", and exit 0 or 1 as the only answers.
2. `.claude/agent-memory/orchestrator/project_team-roster.md:4` — the front matter uses the flat `type: project`. `manage-memory` Memory File Format and every other tracked memory use `metadata: type:`. Init line 121 still tells agents to write the roster with "type `project`", which is the source of the drift. Fix the template wording or the file; not blocking.
3. `.claude/agent-memory/ai-dlc-orchestrator/project_mods-release-scope.md:12` — it points to `docs/handoffs/RES-20261020-ai-dlc-mods/00-approved-plan.md`, which does not exist in the working tree (Glob found nothing). A committed memory should not carry a dangling reference. Either commit that file or drop the pointer.
4. `.claude/agent-memory/ai-dlc-agent-manager/project_handoff-gaps.md:12-13` — it names a local-only entry in `.claude/settings.local.json` and a work-item folder that "does not exist". This is not sensitive, and it is stale-prone, so it will go wrong for any other cloner. Reword it as a general to-do or drop the machine-local detail.
5. `.claude/agent-memory/ai-dlc-orchestrator/project_mods-release-scope.md:14` — `~/.claude/projects/<proj>/<session>/subagents/…` is a generic placeholder with no person named. It is fine under the new policy. I checked it so you do not have to.
6. `plugins/claude/ai-dlc/skills/manage-memory/SKILL.md:54` — "Check the content … drop any secret or personal data, and tell the caller what you dropped" is clear. But `Load` and `Refresh` never re-scan. Section 14-25 covers the case of finding one in an existing memory, but only as prose with no step. Consider adding the scan to Audit (line 93 onward), which is the natural home.

## Focus answers
- **Init check safety.** The negation and `.git/info/exclude` cases are correct. The handback's scratch-repo tests back them, and `check-ignore -v` on a negated match still returns 1.
- **Silent breakage.** The cases are in Major 1, 2 and 3. Nothing else would silently break a developer's gitignore: the global-excludes and `info/exclude` paths are explicitly "never edit".
- **Consistency.**
  - The rule at `.claude/rules/plugin-development.md:21`, `AGENTS.md:345`, `tools/templates/AGENTS.template.md:61`, the generated `plugins/claude/ai-dlc/skills/init/templates/AGENTS.md:345` and `manage-memory/SKILL.md:16-25` all say the same thing.
  - No contradiction remains with "agent memory belongs to target repositories, not the plugin repo". The comment is gone from `.gitignore`, and no other file in the repo repeats it. I grepped the docs, plugins and rules.
  - `plugins/claude/ai-dlc/agents/agent-manager.md:168` and `agent-management/SKILL.md:56-59` scaffold memory without mentioning the secrets rule. They are consistent but do not point to it. That is optional.
- **Folder split.** The change does not make it worse. It exposes it: both `orchestrator/` and `ai-dlc-orchestrator/` become visible in git. Nothing more to add.

## Unverified claims
- The handback's scratch-repo results (`.scratch/aaw-track-memory/t1`) were not re-run; I read the claims only. They match documented git behaviour.
- The `git check-ignore -q` exit 1 and the check outputs (139 tests, `--check`, `validate`) come from the orchestrator's brief and were not re-run by me.
- That the secrets scan was exhaustive is not independently proven. I read all 13 files line by line and found nothing, apart from Minor 3 and 4.

## What is good (keep it)
- The `manage-memory` "Committed with the repository" section is specific: it names each kind of secret and personal data, bans machine paths that name a person, and says a committed secret needs rotating, not just deleting.
- Init never edits `.git/info/exclude` or the global excludes file. It falls back to a repo-level negation and tells the developer the exact file and line when a parent-folder rule blocks it.

Files reviewed (absolute):
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\.gitignore
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\.claude\rules\plugin-development.md
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\AGENTS.md
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\tools\templates\AGENTS.template.md
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\init\SKILL.md
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\plugins\claude\ai-dlc\skills\manage-memory\SKILL.md
- e:\Projects\personal\ai-dlc-agent-workflow-plugin\.claude\agent-memory\ (all 13 files)

PASS
