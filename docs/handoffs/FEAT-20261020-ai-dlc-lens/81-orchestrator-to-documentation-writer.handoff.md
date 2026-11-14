---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — release notes: add herdr
lifecycle: Release (segment of AI-DLC)
step: 81
from: orchestrator
to: documentation-writer (team with brutal-critique)
mode: team
loop: none (critique loop 81.l1: gate-critique 2 / 1, rounds --json default)
gate: none
verification: pending
date: 2026-11-14
---

# 81 orchestrator → documentation-writer: add the herdr skill and its pane layout to the v1.0.0-preview1 notes

## Why
The human (2026-11-14) said "yes" to adding herdr to the release notes: the `v1.0.0-preview1` section of `CHANGELOG.md` (also the GitHub prerelease body, `.scratch/release-75/notes.md`) does not mention herdr at all, although v1.0.0-preview1 ships it.

## What ships (verified by the orchestrator from git)
- **The `herdr` skill** (Claude Code only), run `docs/handoffs/AAWP-20261112-herdr-skill/` (status done): commits 80d9d2e, c48e5bf, a7e8068, 915b66b — all in the first tag (9eae890) and in the current tag. Source of truth for what it does: `plugins/claude/ai-dlc/skills/herdr/SKILL.md` and that run's `run.v2.md` (*Clarified intent*, *Decisions*).
- **Pane layout** (d646698, run step 1.2.l3; done 2026-11-14): `open` / `run` place watch panes by herdr's layout, stacking while each keeps at least 10 rows and starting a new column after that; fallback to the old one-column rule when the layout is unavailable; known limit: the run's first pane halves the session pane, so a narrow session pane caps the run's column. Shipped in the re-tagged v1.0.0-preview1 (tag → 07e2c7f, PR #27).
- Status: done for both (run states `status: done`), so no marker. Never install herdr; Claude Code only (`tools/claude-only-skills.json`).

## Instructions for the receiver (`dw-81`)
1. Line 1 of your hand-back: `handoff 81-orchestrator-to-documentation-writer.handoff.md: passed|failed — <why>`.
2. Edit only `CHANGELOG.md`, section `v1.0.0-preview1`, *What ships* (and *Known open* only if a herdr limit belongs there). Keep the existing format, CRLF / LF as the file already is (your memory `feedback_crlf-when-scripting-docs.md`); prefer the Edit tool. Every claim traceable to SKILL.md or the run records. Don't change the date line unless the critique says the re-tag date must show; say what you decided.
3. Write `81-documentation-writer-to-orchestrator.handback.md` and `81-documentation-writer-to-brutal-critique.handoff.md`, message `bc-81`, and tell `team-lead` the record names. A REVISE comes back to you peer to peer as round `81.l1.1`; a second REVISE stops and goes to `team-lead`.
4. No commits; don't touch `.scratch/release-75/notes.md` (the lead has devops-engineer update the prerelease body from your section afterwards).

## Team
`dw-81` (this task), `bc-81` (critique, PASS / REVISE; send the verdict to `dw-81` to store verbatim as `81-brutal-critique-to-documentation-writer.handback.md` if you cannot write). Message by name.

## Suggested skills
`ai-dlc:write-documentation`, `ai-dlc:handoff`.
