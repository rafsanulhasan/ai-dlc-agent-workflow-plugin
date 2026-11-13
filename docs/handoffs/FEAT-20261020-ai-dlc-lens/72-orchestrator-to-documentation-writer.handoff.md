---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 (tier 1 of FEAT-20261020-ai-dlc-lens)
lifecycle: Release (segment of AI-DLC)
step: 72
from: orchestrator
to: documentation-writer
mode: team
loop: none
gate: none (before the deploy; the human approved the release gate 2026-11-13, record 71)
verification: pending
date: 2026-11-13
---

# 72 orchestrator → documentation-writer: release notes for v1.0.0-preview1

## Goal
The human approved the release gate: a GitHub **prerelease**, tag `v1.0.0-preview1`, covering `ai-dlc` `1.0.0-preview1` and `ai-dlc-lens` `0.1.0` (no version bump). Write the release notes, which must exist and pass critique before deploy.

## Artifacts — verified: exist
- `docs/plans/release-tier-1.checklist.md` — scope (section 2) and your Docs update request (section 8).
- `70-product-owner-to-orchestrator.handback.md` — "Must exist before deploy", item 1: what the notes must contain.
- `71-orchestrator-to-human.handoff.md` and `run.v4.4.md` *Gates and loops* — the approved waivers.
- `docs/backlog/backlog.md`, `docs/plans/tier-1-g4-checklist.md` — item statuses.

## The notes must contain (product-owner, 70)
- Both plugins with their versions, and what each ships (the in-scope, done items).
- The 19 carried items, listed as not included.
- Known open: ITEM-098 (live checks), ITEM-104 (M35), the live check of running ai-dlc and ai-dlc-lens together on Claude Code 2.1.323 (say plainly that it is unverified), the Node 22 repository-test run, and the third-party notice items marked "Not verified".
- That CI could not run (GitHub Actions billing lock) and local checks were used instead.
- That it is a prerelease, and that installs from `main` since 2026-10-22 already report `1.0.0-preview1`, so they will not see this build as an update.

## Instructions for the receiver (`dw-72`)
1. Line 1: `handoff 72-orchestrator-to-documentation-writer.handoff.md: passed|failed — <why>`.
2. Write a new `CHANGELOG.md` at the repository root with a `v1.0.0-preview1` section (the human chose "GitHub Release body plus a CHANGELOG.md seeded from it", product-owner Q6); devops-engineer will use that section as the Release body. Every claim traceable to a record or backlog item; status wording per `.claude/rules/docs-status.md`. Describe only what ships.
3. Write `72-documentation-writer-to-orchestrator.handback.md` (mode: team) and `72-documentation-writer-to-brutal-critique.handoff.md`, message `bc-72`, and tell `team-lead` the record names. No commits. A REVISE comes back to you peer to peer as round 1 (`72.l1.1`); anything after that goes to `team-lead`.

## Team
`dw-72` (this task), `am-17` (MANUAL-CHECKS cells, separate), `bc-72` (critiques both). Message by name.

## Suggested skills
- `ai-dlc:write-documentation`, `ai-dlc:handoff`.
