---
run: FEAT-20261020-ai-dlc-lens
work-item: FEAT-20261020-ai-dlc-lens (scope v2), tier 1 — pre-G4 work of 2026-11-13
lifecycle: AI-DLC
step: 65
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (precedes G4 tier 1; the human asked for the CI check before G4)
verification: pending
date: 2026-11-13
---

# 65 orchestrator → devops-engineer: commit the pre-G4 work and push `feat/ai-dlc-lens`, then report the CI run

## Goal
The human decided (2026-11-13) that only devops-engineer commits, and that root 63's Node 22 check runs in CI after this push. Commit this session's verified work in coherent, signed commits, push the branch, and report CI.

## Artifacts — the change set (`git status` at HEAD 47a3480; every path below was verified against its hand-back in `run.v4.4.md`)
Commit in this order, staging **only the listed paths** (`git add -- <paths>`; never `git add -A`):

1. **Hooks, tests and type fixes — ITEM-034 tests + AC-17.3.7 guard, the 2.1.323 band-test fix (ITEM-112), the 2.1.323 validate fix (ITEM-113).** Their hunks interleave in `keepalive.ts`, `cache-state.ts`, `keepalive.test.ts`, `auto-handoff.test.tsx` and the ATTRIBUTION files, so they are one commit: `plugins/claude/ai-dlc/hooks/` (all changes), `plugins/claude/ai-dlc-lens/hooks/` and `plugins/claude/ai-dlc-lens/tests/` **except** `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md` (commit 2), `plugins/claude/ai-dlc-lens/types/` if changed, `tests/` (the resolve hook `tests/support/`, `tests/hooks-import-extensions.test.mjs`, the changed build test and Node suites), and any other changed path under `plugins/claude/ai-dlc*/` that is not a notice file. Records: 17.3.l1.1, 17.4.l1.*, 42.2.l1.1-42.4.l2.1.2, 63.2-63.4.2.
2. **ITEM-056 notices + spec licence fix.** `THIRD_PARTY_NOTICES.md`, `plugins/claude/ai-dlc-lens/THIRD_PARTY_NOTICES.md` (new), `plugins/claude/ai-dlc-lens/NOTICE.md`, `plugins/claude/ai-dlc-lens/ATTRIBUTION.md`, `plugins/claude/ai-dlc-lens/hooks/ATTRIBUTION.md`, `plugins/claude/ai-dlc-lens/renderer/BUILD.md`, `docs/specs/diagramming.spec.md`, `docs/specs/diagramming.lld.md`. Records: 20.5*, 20.1.l4.*.
3. **Backlog and plans.** `docs/backlog/backlog.md`, `docs/plans/tier-1-g4-checklist.md`. Records: 61, 62, 64, 44.1.l2.11.
4. **Run records.** `docs/handoffs/FEAT-20261020-ai-dlc-lens/` (all new and changed files, `run.v4.4.md` included) and `docs/handoffs/AAWP-20261112-herdr-skill/run.v2.md`.
5. **Agent memory written by this run.** `.claude/agent-memory/ai-dlc-orchestrator/feedback_aawp-as-agent-team.md`, `feedback_commits-by-devops.md`, the changed `feedback_gpg-signed-commits.md`; `.claude/agent-memory/ai-dlc-agent-manager/reference_licence-fetch-recipe.md` and any other changed file in that folder; `.claude/agent-memory/ai-dlc-research-assistant/` (new). Read each first: no secrets, credentials, tokens or personal data (the memory rule); a file that holds any is left out and reported.

**Never stage:** `.ai-dlc/model-metadata.json` (hook-written); `.claude/agent-memory/ai-dlc-orchestrator/project_preview2-specsmd-decisions.md` and `.claude/agent-memory/ai-dlc-orchestrator/MEMORY.md` (written by another session during this run — the human decides); anything under `.scratch/` or `.worktrees/`. Anything changed that fits none of the groups above: leave it out and list it.

## Rules
- Signing stays on (`commit.gpgsign=true`); never `--no-gpg-sign`. If a commit waits on pinentry, say so in your report and wait; do not retry in a loop.
- Messages: conventional style like the branch's history (`git log --oneline -10`), naming the items and step codes, each ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UvATr6k9bjokgoE1Y7iBPT`.
- Before pushing, quote `node tools/build-copilot.mjs --check` and `node .claude/scripts/sync-harness.mjs --check` (both must be exit 0; the Stop hook enforces the first). Do not run the test suites — they were run and reviewed.
- Push `feat/ai-dlc-lens` to `origin` (no force). Then watch the CI run for that push (`.github/workflows/validate.yml`) with `gh run list --branch feat/ai-dlc-lens` / `gh run watch` and quote its result per job, the Node 22 repository-test step in particular. If it fails, quote the failing step's log tail and stop; do not fix anything.

## Instructions for the receiver
1. Line 1: `handoff 65-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. Do the five commits, the two checks, the push and the CI watch as above.
3. Report compressed: each commit's hash and subject with its `git show --stat` summary line, the paths left out (and why), the two checks quoted, the push output, and the CI result per job. Next hop: the orchestrator writes the G4 record.

## Suggested skills
- `ai-dlc:github-ci-automation` (reading the CI run), `ai-dlc:handoff`.
