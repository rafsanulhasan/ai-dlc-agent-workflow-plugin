---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — re-tag after PR #28
lifecycle: Release (segment of AI-DLC)
step: 84
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (the human: "merged", 2026-11-14)
verification: pending
date: 2026-11-14
---

# 84 orchestrator → devops-engineer: tag v1.0.0-preview1 on the PR #28 merge commit; re-create the prerelease

## State (verified by the orchestrator, 2026-11-14)
- PR #28 MERGED; merge commit `57ca76b485582f688f63da1b7f475dedfe9d19f5` = `origin/main`; its tree equals `feat/ai-dlc-lens` `7cd8634` (`git diff --stat 7cd8634 origin/main` empty).
- No tag `v1.0.0-preview1` on origin; no GitHub release of that name.
- Notes: `.scratch/release-83/notes.md` (11849 bytes, the `## v1.0.0-preview1 - 2026-11-14` section of `CHANGELOG.md`).

## Steps (as record 80)
1. Line 1: `handoff 84-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. `git fetch origin`; confirm `origin/main` = `57ca76b…`; confirm no local tag `v1.0.0-preview1` (if one exists locally, report and stop — do not delete it).
3. `git tag -s v1.0.0-preview1 57ca76b485582f688f63da1b7f475dedfe9d19f5 -m "v1.0.0-preview1"` (GPG; never disable signing; if pinentry waits, report at once and stop). Quote the `gpg: Good signature` line of `git tag -v v1.0.0-preview1` (redact the e-mail address). `git push origin v1.0.0-preview1`.
4. `gh release create v1.0.0-preview1 --verify-tag --prerelease --title "v1.0.0-preview1" --notes-file .scratch/release-83/notes.md`.
5. Quote `git ls-remote --tags origin v1.0.0-preview1`, `git rev-parse 'v1.0.0-preview1^{commit}'`, `gh release view v1.0.0-preview1 --json tagName,isPrerelease,url,publishedAt`.
6. No commits. Report compressed.
