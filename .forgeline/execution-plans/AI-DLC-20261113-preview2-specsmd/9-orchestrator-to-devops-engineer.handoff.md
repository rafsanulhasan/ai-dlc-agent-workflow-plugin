---
step: 9
from: orchestrator
to: devops-engineer
date: 2026-11-14
run: AI-DLC-20261113-preview2-specsmd
stage: whole-run checkpoint commit — feature 8 (AAWP done) plus the pending G3 set and records
verification: pending
---

# Handoff: commit feature 8 and the open run records (two checkouts)

## A. Worktree `E:\Projects\personal\ai-dlc-agent-workflow-plugin\.worktrees\preview2-planning`, branch `plan/preview2` (HEAD 8b35a33)
Commit everything feature 8 and this run left uncommitted (`git status -s`: about 257 entries — staged renames into `.forgeline/`, modified files, untracked records, tests, `tools/build-standards.mjs`, the bank changes, the G3 set from the previous session), **except**:
- `.ai-dlc/model-metadata.json` (written by a hook; never stage it);
- anything under `.scratch/` (gitignored anyway).
Check before committing: no secrets, credentials or tokens in `.claude/agent-memory/**` files being added (manage-memory rule); list the memory files you checked.
Message (subject + body; end with the attribution line below):
`chore(preview2): feature 8 — .forgeline dogfood layout, standards build, G3 set pending`
Body: what moved (execution-plans, memory-bank → `.forgeline/`; artifacts keys), standards generator + Stop chain + CI, docs-status template wording, plugin-management skill, ADR-0017 and spec delta r2 (G2 amendment pending human approval at G3), run records up to step 8.5.4.l1.2. Then a blank line and:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
Sign it (`-S`; never disable signing; tell the lead if pinentry waits).

## B. Main checkout `E:\Projects\personal\ai-dlc-agent-workflow-plugin`, branch `feat/ai-dlc-lens`
Commit only these two paths (D60): the deletion of `.claude/agent-memory/ai-dlc-software-architect/project_preview2-unit-design.md` and the one-line change to `.claude/agent-memory/ai-dlc-software-architect/MEMORY.md`. That checkout has other uncommitted work from another run (`docs/handoffs/FEAT-20261020-ai-dlc-lens/…`, `CHANGELOG.md`, research memory): do not stage or commit any of it — use `git commit -S --only -- <the two paths>`. Message: `chore(memory): move architect preview2 unit-design memory to plan/preview2` + blank line + the same Co-Authored-By line.

## Hand-back
Line 1 `handoff .forgeline/execution-plans/AI-DLC-20261113-preview2-specsmd/9-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`; for each commit: hash, `%G?`, `git show --stat` summary; proof that `.ai-dlc/model-metadata.json` is not in A and that B contains exactly the two paths; `git status -s` of both checkouts after.
