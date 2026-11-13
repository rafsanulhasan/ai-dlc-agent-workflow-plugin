---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1
lifecycle: Release (segment of AI-DLC)
step: 74
from: orchestrator
to: sqa-engineer
mode: subagent
loop: none
gate: none (pre-deploy check; the human waived CI and approved the release gate, record 71)
verification: pending
date: 2026-11-13
---

# 74 orchestrator → sqa-engineer: local checks on the release commit 12cd1f1

## Goal
CI cannot run (GitHub Actions billing lock), and the human waived it on the condition that the local checks pass on the actual release commit (product-owner, `70-product-owner-to-orchestrator.handback.md`, "Must exist before deploy" item 2). Run them on `12cd1f1` and quote real output; devops-engineer merges and tags only if they pass.

## Artifacts — verified
- `feat/ai-dlc-lens` at `12cd1f1` (signed, pushed); working tree clean except `.ai-dlc/model-metadata.json` (hook-written; ignore it).
- `73.l1.1-devops-engineer-to-orchestrator.handback.md` — the two release commits.

## Instructions for the receiver
1. Line 1: `handoff 74-orchestrator-to-sqa-engineer.handoff.md: passed|failed — <why>`.
2. Confirm `git rev-parse --short HEAD` is `12cd1f1` and quote `git status --short`, and `claude --version` and `node --version`.
3. Run **one at a time, never in parallel** (parallel `plugin test` runs hit the 5 s per-test timeout, seen in 63.3), quoting each command, its summary lines and exit code:
   - `node --test "tests/**/*.test.mjs"`
   - `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc`
   - `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc-lens`
   - `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc`
   - `npx @anthropic-ai/claude-code plugin validate --strict ./plugins/claude/ai-dlc-lens`
   - `npx @anthropic-ai/claude-code plugin validate --strict .`
   - `node tools/build-copilot.mjs --check`
   - `node tools/validate.mjs --check`
4. After the runs, quote `git status --short` again: nothing may have changed apart from `model-metadata.json`. If a check writes a file, report it and stop.
5. A failure: quote the failing names and output and stop; do not fix. Don't commit.
6. Report compressed: the table `command | summary | exit`, both `git status` outputs, versions. Next hop: devops-engineer deploys only on a passed report.
