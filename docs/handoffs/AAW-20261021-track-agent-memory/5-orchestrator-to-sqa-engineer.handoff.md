---
run: AAW-20261021-track-agent-memory
work-item: none
lifecycle: AAW
step: 5
from: orchestrator
to: sqa-engineer
mode: subagent
loop: none
verification: pending
date: 2026-10-21
---

# Handoff 5: orchestrator -> sqa-engineer (AAW code path)

## Goal
`tools/build-copilot.mjs` changed in this run (a one-string change: the Copilot platform note now names the memory folder `.claude/agent-memory/ai-dlc-<agent>/`). Decide whether a test is warranted and write it if so. Test command: bare `node --test`; tests live in `tests/`, only `node:test` and `node:assert`, never shipped.

## Required context
- Change: `git diff tools/build-copilot.mjs`; generated copy `plugins/claude/ai-dlc/skills/plugin-management/templates/build-copilot.mjs`.
- Why: `docs/handoffs/AAW-20261021-track-agent-memory/2.l1-agent-manager-to-orchestrator.handback.md` (item 5).
- Rule: each agent has one memory folder named like Claude Code's native folder (`ai-dlc-<agent>` for plugin agents).

## Check output
Orchestrator re-ran after round 2 (both agent-manager instances done, rebuilt after step 4): `node tools/build-copilot.mjs --check` -> up to date (0 files changed on rebuild); `node .ai-dlc/workflow.mjs validate` -> valid; `node --test` -> 139 pass, 0 fail; `git check-ignore -q .claude/agent-memory/ai-dlc-orchestrator/MEMORY.md` -> exit 1; `.claude/agent-memory/` holds only `ai-dlc-*` folders. `.claude/settings.json` has an unrelated human change and is out of scope.

## Deliverable
Line 1 exactly: `handoff 5-orchestrator-to-sqa-engineer.handoff.md: passed|failed — <why>`. Then tests written (path:lines) with real `node --test` result lines, or a reasoned "no test warranted"; any finding where the code is wrong (path:line). Write only under `tests/`; do not commit. Next hop: code-reviewer.
