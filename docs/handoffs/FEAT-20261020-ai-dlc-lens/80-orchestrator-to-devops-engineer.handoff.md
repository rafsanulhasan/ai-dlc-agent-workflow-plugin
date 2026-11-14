---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — re-tag
lifecycle: Release (segment of AI-DLC)
step: 80
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (the human's instruction, 2026-11-14: "after the pr got merged ... ask gene to tag it again")
verification: pending
date: 2026-11-14
---

# 80 orchestrator → devops-engineer: tag v1.0.0-preview1 on the PR #27 merge commit; re-create the prerelease

## State (verified by the orchestrator, 2026-11-14)
- PR #27 MERGED 2026-11-14T00:56:28Z; merge commit `07e2c7f6d4d2f5a3e52e16620aa6b962c19eed5c` = `origin/main` (merged in the GitHub UI; `%G?` = E locally, GitHub's web-flow key).
- No tag `v1.0.0-preview1` on origin; no GitHub release of that name (deleted by the human).
- Notes: `.scratch/release-75/notes.md` (9570 bytes, the body of the first prerelease).

## Steps
1. Line 1: `handoff 80-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. `git fetch origin`; confirm `origin/main` = `07e2c7f…`.
3. Signed annotated tag on that commit: `git tag -s v1.0.0-preview1 07e2c7f6d4d2f5a3e52e16620aa6b962c19eed5c -m "v1.0.0-preview1"` (GPG; never disable signing; if pinentry waits, report at once and stop). Quote `git tag -v v1.0.0-preview1` (first line of the gpg result is enough) and push it: `git push origin v1.0.0-preview1`.
4. Re-create the prerelease: `gh release create v1.0.0-preview1 --verify-tag --prerelease --title "v1.0.0-preview1" --notes-file .scratch/release-75/notes.md` (title as the first release had it; check with your 75 record if different).
5. Quote `git ls-remote --tags origin v1.0.0-preview1`, `git rev-parse 'v1.0.0-preview1^{commit}'` and `gh release view v1.0.0-preview1 --json tagName,isPrerelease,url,publishedAt`.
6. No commits, no other changes. Report compressed.
