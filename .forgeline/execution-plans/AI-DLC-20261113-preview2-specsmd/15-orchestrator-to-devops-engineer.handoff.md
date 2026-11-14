---
step: 15
from: orchestrator
to: devops-engineer
date: 2026-11-14
run: AI-DLC-20261113-preview2-specsmd
stage: whole-run — open a pull request for plan/preview2 (human request: "create pr")
verification: pending
---

# Handoff: push plan/preview2 and open a PR into main

Worktree `E:/Projects/personal/ai-dlc-agent-workflow-plugin/.worktrees/preview2-planning`, branch `plan/preview2` (HEAD d445442, clean, includes origin/main c12664b). Repo: the `origin` remote (rafsanulhasan/…; read it from `git remote -v`).

1. First commit this handoff record (signed, `-S`, message `chore(preview2): record PR handoff (step 15)` + blank line + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), so the branch is clean.
2. `git push -u origin plan/preview2`. Never force-push.
3. `gh pr create --base main --head plan/preview2` with:
   - Title: `preview2 planning: specsmd memory bank, .forgeline layout, G3-approved plan (15 bolts)`
   - Body (Markdown), short sections:
     - **What**: the approved preview2 planning (intent 001 with FR-18 G1 amendment; spec 001 + deltas r1/r2; ADR-0011–0017; units engine/lens; 15 bolts, 38 stories; task plan and backlog ITEM-111–127) under `.forgeline/memory-bank/`; run records under `.forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/`.
     - **Repo changes (feature 8)**: this repo dogfoods `.forgeline/` (memory bank, run folders; all `artifacts` keys in `.ai-dlc/workflow.json`); `tools/build-standards.mjs` generates `.claude/rules` and `.github/instructions` from `.forgeline/memory-bank/project/standards/` (Stop hook step 0, CI `--check`); plugin `docs-rules` template lists standards as agent artifacts (ADR-0017); `plugin-management` skill updated; hooks TS5097 fix cherry-picked from feat/ai-dlc-lens (8b35a33).
     - **Not in this PR**: no bolt is built; `.ai-dlc/` plugin-wide move is bolt 015; consumer layout ships with the bolts.
     - **Verification**: on the merged branch — `node --test "tests/**/*.test.mjs"` 1350 tests, 0 fail; `plugin test` ai-dlc 1007/0, ai-dlc-lens 926/0; `plugin validate --strict` ×3 pass; build-copilot / build-standards / sync-harness `--check` and `workflow.mjs validate` pass (record 13).
     - **Gates**: G1 (with FR-18 amendment), G2 (with delta r2 / ADR-0017 amendment), G3 approved by the human 2026-11-14 (gate record 10).
     - End the body with a blank line and exactly: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
   - Do not enable auto-merge; no reviewers or labels unless the repo requires them.
4. Report the PR URL and number.

Hand-back: line 1 `handoff .forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/15-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`; commit hash and %G?, push output summary, PR URL, `git status -s` after.
