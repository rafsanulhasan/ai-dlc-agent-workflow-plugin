---
run: AAW-20261016-stack-commands-out-of-agents-md
work-item: none
lifecycle: AAW
step: 2
from: brutal-critique
to: orchestrator
mode: subagent
loop: none
received: 2026-10-16
---

# Hand-back: brutal-critique, round 1 — verdict: PASS

No Blocker or Major. Minors (listed for the closing report; Minors never start a round per aaw-review.md):
- AGENTS.md:8, tools/templates/AGENTS.template.md:8 — pointer quotes heading "Project commands" of CLAUDE.md; root CLAUDE.md uses `## Commands` (skip marker), and "keep theirs" repos differ → drop the quoted heading.
- skills/init/references/managed-blocks.md:31 — "same values" in both platform files can diverge when a developer keeps their own section in one → say init only fills blocks it owns.
- skills/csharp-mutation-testing/SKILL.md:16 — points to CLAUDE.md / AGENTS.md for threshold, doesn't name the command → match ts-mutation-testing:16.
- agents/product-manager.md:137 — "e.g. `dotnet test` or `npm test`" in an agent (pre-existing; language-agnostic rule).
- agents/devops-engineer.md:37,51 — `npm publish --provenance`, `dotnet pack`, `npm pack` in agent body (pre-existing; out of scope).
- Generic skills handoff, fix-bug, implement-feature, review, write-tests, playwright-mcp-ui-testing keep "for example `dotnet build` / `npm test`" next to the new pointer (examples only).

Clean: no stale "commands in AGENTS.md" pointer; block name/placement consistent; legacy migration coherent; persona-name rule respected; root copilot-instructions has filled block.

Decisions 1–6 judged acceptable; 2,3,5,6 fine. Questions for human:
- Q1: Does the rule also cover ai-dlc plugin tooling commands in the orchestrator persona (`node .ai-dlc/workflow.mjs ...`, `node .claude/scripts/sync-harness.mjs --check`, `node tools/build-copilot.mjs --check`)?
- Q2: Providers reading only AGENTS.md (Codex, Cursor) no longer get build/test/mutation commands — acceptable?
