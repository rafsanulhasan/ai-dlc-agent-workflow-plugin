---
run: AAWP-20261112-herdr-skill
work-item: feature 1 follow-up — herdr watch-pane layout; commit
lifecycle: AAWP
step: 3
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none (AAWP has no gates)
verification: pending
date: 2026-11-14
---

# 3 orchestrator → devops-engineer: commit the herdr pane-layout follow-up; push

## Artifacts (verified by the orchestrator against git diff and the records)
- Code: `plugins/claude/ai-dlc/skills/herdr/scripts/herdr.mjs` (am-h3, 1.2.l3.1).
- Docs (agent artifact): `plugins/claude/ai-dlc/skills/herdr/SKILL.md` (1.2.l3.1, 1.2.l3.2; critique PASS 1.5.2.l2.2).
- Tests: `tests/herdr/herdr-layout.test.mjs` (new), `tests/herdr/herdr-open-close.test.mjs`, `tests/herdr/helpers/fake-bin.mjs` (sqa-h3, 1.3.l3.1: 1310 / 1303 pass / 0 fail / 7 skipped).
- Records in `docs/handoffs/AAWP-20261112-herdr-skill/`: every untracked `1.2.l3.*`, `1.3.l3.*`, `1.4.1.l3.*`, `1.4.2.l2.*`, `1.5.2.l2.*` file, this file, and `run.v2.md`.
- Also untracked from the lens run: `docs/handoffs/FEAT-20261020-ai-dlc-lens/78-devops-engineer-to-orchestrator.handback.md`.
- **Leave out:** `.ai-dlc/model-metadata.json` (hook-owned) and `.claude/agent-memory/ai-dlc-software-architect/*` (written by another session, not this run).

## Constraints
- GPG-signed; never disable signing. If pinentry waits for the human, report it at once and stop.
- Stage by explicit path only. No merge, tag or release.
- End each commit message with:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UvATr6k9bjokgoE1Y7iBPT
  (use these exact lines, whatever model you run on).

## Instructions for the receiver
1. Line 1: `handoff 3-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. Commit 1: `feat(herdr): place watch panes by layout, new column before a pane drops below 50x10` — herdr.mjs, SKILL.md, the three test files.
3. Before committing, run and quote with exit codes: `node tools/build-copilot.mjs --check`, `node .claude/scripts/sync-harness.mjs --check`, `node --test "tests/**/*.test.mjs"` (glob quoted).
4. Commit 2: `chore(handoffs): herdr pane-layout follow-up recorded (1.2.l3-1.5.2.l2, step 3); lens step 78 hand-back` — the records, run.v2.md, the lens 78 hand-back.
5. Push `feat/ai-dlc-lens`. Quote `git log --format='%h %G? %s' -3`, the push output and `git status --short`.
