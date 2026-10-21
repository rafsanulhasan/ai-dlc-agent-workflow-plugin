---
run: AAW-20261021-absorb-auto-handoff
work-item: WI-4
lifecycle: AAW
step: 2
from: agent-manager
to: orchestrator
mode: subagent
loop: none
received: 2026-10-21 11:40
---

handoff 2-orchestrator-to-agent-manager.handoff.md: passed — plan WI-4, research hand-back 1 (AC-1/AC-5), the mod folder, `skills/handoff/SKILL.md` and `tools/build-copilot.mjs` all exist and match; run state step 2 `in-progress`.

AC-1…AC-9 met on disk; nothing committed; sibling WI-1 / vendoring changes kept.

**Changed paths**
- plugins/claude/ai-dlc/hooks/hooks.json — code — new; only `modules: ["./auto-handoff/register.tsx"]`
- plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx — code — moved; +`git`, `activeRun`, run-aware brief/seed/run.md write
- plugins/claude/ai-dlc/hooks/auto-handoff/run.ts — code — new pure helpers: find run, edit Next action, assemble session handoff
- plugins/claude/ai-dlc/hooks/auto-handoff/config.ts — code — moved; +`MODULE_DIR`, `SESSION_TEMPLATE`
- plugins/claude/ai-dlc/hooks/auto-handoff/{brief.ts,panel.tsx,server.ts,templates.ts,viewer.ts} — code — moved unchanged
- plugins/claude/ai-dlc/hooks/auto-handoff/statusline/handoff-link.sh — code — moved unchanged
- plugins/claude/ai-dlc/hooks/auto-handoff/tsconfig.json — code — moved; `extends` path adjusted
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/auto-handoff.test.tsx — code — moved; fake git + dirs in fs.list; 9 "ai-dlc run" tests
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/seed-row.test.tsx — code — moved; plugin name `ai-dlc`; run-seed links session handoff test
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/viewer.test.ts — code — moved; import path fixed
- plugins/claude/ai-dlc/hooks/auto-handoff/tests/run.test.ts — code — new unit tests for run.ts
- plugins/claude/ai-dlc/hooks/auto-handoff/templates/{brief.md,instructions.md} — docs — moved unchanged
- plugins/claude/ai-dlc/hooks/auto-handoff/templates/session-handoff.md — docs — new Haiku prompt using the skill's sections
- plugins/claude/ai-dlc/hooks/auto-handoff/LICENSE — docs — upstream MIT text, moved
- plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md — docs — replaces VENDORED.md: incorporated, every change listed
- plugins/claude-mods/auto-handoff/ — code — deleted (was untracked)
- plugins/claude/ai-dlc/.claude-plugin/plugin.json — code — 6 `userConfig` keys added ("Auto-handoff:" titles); `auto-handoff` dependency removed
- .claude-plugin/marketplace.json — code — `auto-handoff` entry removed
- .claude/settings.json — code — `auto-handoff@ai-dlc-agent-workflow` removed from `enabledPlugins`
- .github/workflows/validate.yml — code — new step `plugin test ./plugins/claude/ai-dlc`
- .gitignore — code — ignores `plugins/claude/ai-dlc/.claude-plugin/types/`
- tools/build-copilot.mjs — code — `modules` named Claude-only; fails on module/mod test in copied folders; reports count
- tests/build-copilot-hooks-module.test.mjs — code — new: no Copilot leak, build guards, repo state, template headings parity
- plugins/claude/ai-dlc/skills/handoff/SKILL.md — docs — manual+automatic one procedure; "Last request" section; automatic path; resume exception
- plugins/claude/ai-dlc/agents/orchestrator.md — docs — Run Loop step 1 resumes named run after automatic seed
- AGENTS.md — docs — same Run Loop step 1 sentence (this repo's own orchestrator)
- README.md — docs — mods section rewritten: settings table, kill switches, upgrade note
- CLAUDE.md — docs — architecture, commands, CI, watch-out lines for the hooks module
- THIRD_PARTY_NOTICES.md — docs — auto-handoff incorporated into ai-dlc, not vendored
- plugins/claude/ai-dlc/skills/plugin-management/SKILL.md — docs — layout, manifests, hooks-module rules, test commands, CI
- .claude/rules/plugin-development.md — docs — hooks-module rule; quoted test glob
- .claude/agent-memory/ai-dlc-agent-manager/{feedback_bash-heredoc-backslashes.md,MEMORY.md} — docs — memory: Bash heredocs mangle backslash escapes
- plugins/claude/ai-dlc/skills/init/templates/AGENTS.md — generated — rebuilt
- plugins/claude/ai-dlc/skills/plugin-management/templates/build-copilot.mjs — generated — rebuilt
- plugins/copilot/ai-dlc/{agents/orchestrator.agent.md,skills/handoff/SKILL.md,skills/init/templates/AGENTS.md,skills/plugin-management/SKILL.md,skills/plugin-management/templates/build-copilot.mjs} — generated — rebuilt

**Intent**
The auto-handoff mod is now part of ai-dlc as a Claude-only hooks module under `hooks/auto-handoff/`. Its automatic trigger runs the `handoff` skill's session handoff procedure: with an `active` run.md on the current git branch, before its `/clear` it writes the skill's template to `<scratch root>/<run-folder>/session-<YYYYMMDD-HHMM>.md`, rewrites that run.md's *Next action* to point at it (old action quoted under it) and seeds the fresh session to resume the run; with no active run or outside git it behaves as the mod did. The Copilot build never ships the module, its `hooks.json` or its `userConfig`, and now fails if a module or mod test sits in a folder it copies.

**Checks**
- `node tools/build-copilot.mjs --check` → "Copilot plugin and generated sources are up to date."
- `node --test "tests/**/*.test.mjs"` → tests 170, pass 170, fail 0 (164 before + 6 new)
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc` → "✔ Validation passed" (module hooks + env reads listed; icon warning is a directory check that "does not change the result")
- `npx @anthropic-ai/claude-code plugin validate --strict .` → "✔ Validation passed"
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` → 100 pass, 0 fail, 4 files (81 before the move)
- `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude-mods/cache-keepalive` → "✔ Validation passed"
- `npx @anthropic-ai/claude-code plugin test ./plugins/claude-mods/cache-keepalive` → 3 pass, 0 fail
- `node .ai-dlc/workflow.mjs validate` → ".ai-dlc\workflow.json: valid"
- `node .claude/scripts/sync-harness.mjs --check` → "7 change(s) pending" — identical before and after this change (repo has no Copilot twins; not synced)

**Open risks**
- No live Claude Code session run; all tests use `plugin test` fakes. Real engine's `$.fs.list` dir labelling not verified: the code treats any non-`'file'` entry as a candidate run folder.
- Run lookup needs `git` on PATH via `$.process.run` (`git -C <cwd> rev-parse …`); without it the module falls back to the mod's own brief.
- `linkify` only links POSIX absolute paths, so on Windows the session-handoff path in the seed is not clickable (pre-existing mod behaviour).
- `/config` values set under the old `auto-handoff` plugin do not carry over to `ai-dlc`; the README tells standalone users to uninstall or prune it.
- The module writes run.md in the repository mid-session on the main agent's behalf; the skill's *Run state* "Who writes it" now says so.
- The Copilot orchestrator and `handoff` skill mention the Claude-only automatic seed (labelled Claude Code).
- I also edited root `AGENTS.md` so this repo's orchestrator matches — beyond AC-8's literal scope; revert that one line if unwanted.
- Scratch edit scripts are in `.scratch/wi4/` (gitignored).
