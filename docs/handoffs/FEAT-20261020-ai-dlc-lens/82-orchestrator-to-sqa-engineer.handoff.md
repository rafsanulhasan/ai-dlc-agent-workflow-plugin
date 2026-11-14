---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — local checks for the re-release
lifecycle: Release (segment of AI-DLC)
step: 82
from: orchestrator
to: sqa-engineer
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-11-14
---

# 82 orchestrator → sqa-engineer: re-run the release checks on the code the re-tag will point at

## Why
v1.0.0-preview1 is being re-tagged (tag and prerelease deleted by the human). The code since step 74's checks (12cd1f1) gained d646698 (herdr pane layout) and records; `main` = `07e2c7f`, whose tree equals `feat/ai-dlc-lens` HEAD `9e2cf19` except the uncommitted `CHANGELOG.md` edit (step 81) and run records, which no check depends on. `CHANGELOG.md` *Checks* (lines ~82-87) still quotes step 74's counts; critique 81 (Major 2) asks for counts that cover the shipped code.

## Steps (as record `74-orchestrator-to-sqa-engineer.handoff.md`, steps 2-6)
1. Line 1: `handoff 82-orchestrator-to-sqa-engineer.handoff.md: passed|failed — <why>`.
2. Quote `git rev-parse --short HEAD` (expect `9e2cf19`), `git diff --stat 07e2c7f HEAD -- plugins tools tests` (expect empty), `git status --short`, `claude --version`, `node --version`.
3. Run **one at a time, never in parallel**, quoting each command, its summary lines and exit code:
   - `node --test "tests/**/*.test.mjs"`
   - `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`
   - `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens`
   - `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`
   - `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc-lens`
   - `npx @anthropic-ai/claude-code plugin validate --strict .`
   - `node tools/build-copilot.mjs --check`
   - `node tools/validate.mjs --check`
4. Quote `git status --short` afterwards; a check that writes a file: report and stop.
5. A failure: quote it and stop; do not fix. No commits.
6. Report compressed: table `command | summary | exit`, both `git status` outputs, versions. Next hop: documentation-writer updates CHANGELOG *Checks* from your table.
