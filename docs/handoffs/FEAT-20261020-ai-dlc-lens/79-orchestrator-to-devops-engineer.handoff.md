---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — re-release (remove tag, merge the rest, tag again)
lifecycle: Release (segment of AI-DLC)
step: 79
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (the human's instruction, 2026-11-14)
verification: pending
date: 2026-11-14
---

# 79 orchestrator → devops-engineer: remove the v1.0.0-preview1 tag, commit the rest, push, open the PR

## Why
The human (2026-11-14): "there are still some changes left that should be in preview1, but you tagged that without committing them. ask gene to remove the tag. commit everything excluding preview2 artifacts then push and create pr. after the pr got merged, i will let you know. then ask gene to tag it again".

`origin/main` = `9eae890` (PR #26 merge, tag `v1.0.0-preview1` → `9eae890`, GitHub prerelease published). `feat/ai-dlc-lens` = `abe071a` (pushed), 5 commits ahead of main: 36e40d1, d65d777, 930848d, d646698 (herdr pane layout), abe071a.

## Steps
1. Line 1 of your report: `handoff 79-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. **Remove the tag.** A published GitHub Release cannot stay without its tag, so delete the prerelease and the tag together; it is re-created in step 80 with the same notes:
   - keep the notes: `.scratch/release-75/notes.md` (9570 bytes, equal to the current release body length) — confirm it is there before deleting anything; if not, save `gh release view v1.0.0-preview1 --json body --jq .body` into it first;
   - `gh release delete v1.0.0-preview1 --yes --cleanup-tag` (removes the release and the remote tag), then delete the local tag `git tag -d v1.0.0-preview1`;
   - quote `git ls-remote --tags origin v1.0.0-preview1` (empty), `gh release view v1.0.0-preview1` (not found) and `git tag -l v1.0.0-preview1` (empty).
3. **Commit everything except preview2 artifacts**, by explicit path, GPG-signed (never disable signing; if pinentry waits, report it at once and stop):
   - include: `.ai-dlc/model-metadata.json`, `docs/handoffs/AAWP-20261112-herdr-skill/run.v2.md`, `docs/handoffs/AAWP-20261112-herdr-skill/3-devops-engineer-to-orchestrator.handback.md`, `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v4.4.md`, this file;
   - **exclude (preview2):** `.claude/agent-memory/ai-dlc-orchestrator/project_preview2-specsmd-decisions.md`, `.claude/agent-memory/ai-dlc-software-architect/MEMORY.md` and its three `project_preview2-*.md` files, `.claude/agent-memory/ai-dlc-system-engineer/` (preview2 split design), `.claude/agent-memory/ai-dlc-documentation-writer/feedback_crlf-when-scripting-docs.md` (its new addendum is from preview2 step 1.5.l3.6, memory-bank files); the worktree `.worktrees/preview2-planning` (branch `plan/preview2`) is not touched;
   - anything else `git status` shows that is not listed here: do not commit it; list it in your report for the lead.
   - message: `chore(release): pre-preview1 state — run states, herdr follow-up close, model metadata`.
4. Run and quote with exit codes before pushing: `node tools/build-copilot.mjs --check`, `node .claude/scripts/sync-harness.mjs --check`.
5. Push `feat/ai-dlc-lens`, then open a PR `feat/ai-dlc-lens` → `main`: title `v1.0.0-preview1: changes after the first tag (backlog, herdr pane layout, records)`; body: the commits since `9eae890` (one line each), that the tag and prerelease were removed and will be re-created on the merge commit, that CI cannot run (GitHub Actions billing lock) and the local checks used (quote the two checks above and the test run of `d646698`'s commit: `node --test "tests/**/*.test.mjs"` 1310 / 1303 pass / 0 fail / 7 skipped, record `docs/handoffs/AAWP-20261112-herdr-skill/3-devops-engineer-to-orchestrator.handback.md`); end the body with:

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   https://claude.ai/code/session_01UvATr6k9bjokgoE1Y7iBPT
6. **Do not merge.** The human merges and tells the lead; then step 80 re-tags.
7. Report: the deletion evidence, the commit hash with `%G?`, the push output, the PR URL and number, `git status --short`.
