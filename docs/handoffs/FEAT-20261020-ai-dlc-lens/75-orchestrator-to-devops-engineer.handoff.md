---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1
lifecycle: Release (segment of AI-DLC)
step: 75
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (deploy; release gate approved by the human 2026-11-13, record 71)
verification: pending
date: 2026-11-13
---

# 75 orchestrator → devops-engineer: deploy v1.0.0-preview1 — PR, merge, signed tag, GitHub prerelease

## Goal
Stage *deploy* of the Release segment. The human approved the release gate (GO, prerelease, no version bump, waivers); every pre-deploy item exists: release notes (step 72, PASS), item 15 (PASS), local checks on the release commit `12cd1f1` all exit 0 (step 74). Publish: merging to `main` is what users install from.

## Artifacts — verified
- `feat/ai-dlc-lens` at `12cd1f1` (signed, pushed) = the release commit.
- `docs/plans/release-tier-1.checklist.md` section 4 — the deploy steps.
- `CHANGELOG.md` — section `v1.0.0-preview1` (the Release body).
- `74-sqa-engineer-to-orchestrator.handback.md` — the 8 checks, all exit 0.

## Steps
1. Line 1: `handoff 75-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. Confirm `origin/feat/ai-dlc-lens` = `12cd1f1` and that `main` is at `fe7ec7c` (or quote what it is).
3. Open a PR `feat/ai-dlc-lens` → `main` with `gh pr create` (title `Release v1.0.0-preview1: ai-dlc-lens tier 1`; body: a short summary pointing to `CHANGELOG.md` and the run records, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). CI will not run (billing lock; waived) — say so in the body.
4. Merge it with a **merge commit** (no squash, no rebase), as earlier trains did (#21-#25). The merge commit must be signed: if `gh pr merge` cannot sign, merge locally instead (`git switch main`, `git pull`, `git merge --no-ff -S feat/ai-dlc-lens`, push `main`, which closes the PR) — never an unsigned commit on `main`. If pinentry waits, say so; the human is at the machine.
5. Tag: `git tag -s v1.0.0-preview1 <merge commit> -m "v1.0.0-preview1"`, push the tag.
6. Release: extract the `v1.0.0-preview1` section of `CHANGELOG.md` into `.scratch/release-75/notes.md` and run `gh release create v1.0.0-preview1 --prerelease --title "v1.0.0-preview1" --notes-file .scratch/release-75/notes.md --verify-tag`.
7. Quote: the PR URL and number, the merge commit hash with `git log --format='%h %G? %s' -1 main`, the tag with `git tag -v v1.0.0-preview1` (signature line), the Release URL and `gh release view v1.0.0-preview1 --json isPrerelease,tagName,url`.
8. Do **not**: stage or merge `.ai-dlc/model-metadata.json` or the uncommitted memory file `project_preview2-specsmd-decisions.md` (another session's); delete `feat/ai-dlc-lens` or any worktree; change versions; force-push.
9. Any step that fails: stop, quote it, change nothing further.

## Suggested skills
- `ai-dlc:github-cd-automation`, `ai-dlc:handoff`.
