---
run: FEAT-20261020-ai-dlc-lens
work-item: release v1.0.0-preview1 — commit the herdr notes and the re-release records; PR
lifecycle: Release (segment of AI-DLC)
step: 83
from: orchestrator
to: devops-engineer
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-11-14
---

# 83 orchestrator → devops-engineer: commit CHANGELOG.md and records 79-83, push, open the PR

## State (verified by the orchestrator)
- `CHANGELOG.md` (v1.0.0-preview1: herdr added, date 2026-11-14, *Checks* from step 82): critique PASS round 2 of 2 (`81.l1.2-brutal-critique-to-documentation-writer.handback.md`); two post-PASS Minor lines checked by the lead against the records.
- Tag `v1.0.0-preview1` and its prerelease: deleted by the human (lead verified). `origin/main` = `07e2c7f`; `feat/ai-dlc-lens` = `9e2cf19` (= origin), behind main only by the merge commit.

## Steps
1. Line 1: `handoff 83-orchestrator-to-devops-engineer.handoff.md: passed|failed — <why>`.
2. One GPG-signed commit (never disable signing; if pinentry waits, report at once and stop), staged by explicit path:
   - `CHANGELOG.md`
   - `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v4.4.md`
   - every untracked `docs/handoffs/FEAT-20261020-ai-dlc-lens/79*`, `80*`, `81*`, `82*`, `83*` file (list them in your report).
   - **exclude**: `.claude/agent-memory/ai-dlc-documentation-writer/*` and `.claude/agent-memory/ai-dlc-research-assistant/*` (another session's preview2 research and notes), `.ai-dlc/model-metadata.json` unless it changed (hook-owned; include it only if `git status` shows it modified, and say so).
   - message: `docs(release): v1.0.0-preview1 notes add herdr; re-release records (steps 79-83)`.
3. Quote `node tools/build-copilot.mjs --check` and `node .claude/scripts/sync-harness.mjs --check` with exit codes.
4. Push `feat/ai-dlc-lens`; open a PR → `main`: title `v1.0.0-preview1: release notes add herdr; re-release records`; body: the commit, that the notes now list the herdr skill (ITEM-108) and the pane layout, that the checks of step 82 (1310 / 1303 / 0 / 7 skipped; ai-dlc 1007/0; lens 926/0; validates pass; Claude Code 2.1.325, Node 24.11.1) cover the code, that the tag and prerelease will be re-created on the merge commit with the notes from the CHANGELOG section, and that CI cannot run (billing lock); end with:

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   https://claude.ai/code/session_01UvATr6k9bjokgoE1Y7iBPT
5. **Do not merge.** Also write the new prerelease body now: extract the `## v1.0.0-preview1` section of the committed `CHANGELOG.md` (from its heading up to the next `## ` heading or the end) into `.scratch/release-83/notes.md`; report its byte count and first line.
6. Report: commit hash with `%G?`, files, push output, PR URL / number, `git status --short`.
