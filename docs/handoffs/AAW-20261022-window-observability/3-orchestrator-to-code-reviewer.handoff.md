---
run: AAW-20261022-window-observability
lifecycle: AAW
step: 3
from: orchestrator
to: code-reviewer
mode: subagent
loop: AAW/code-review round 0 of 2 (maxFailures 1)
axis: standards + spec (single pass — human one-off override; if changes-requested, re-review uses two passes)
format: compact
---
Review scope: uncommitted working-tree changes vs HEAD bcd492f (`git diff bcd492f -- <paths>`):
- plugins/claude/ai-dlc/hooks/auto-handoff/config.ts, register.tsx, tests/auto-handoff.test.tsx (code)
- plugins/claude/ai-dlc/.claude-plugin/plugin.json, skills/configure-auto-handoff/templates/auto-handoff.schema.json (description-only)
Ignore: .claude/settings.json, .handoff/config.md, flagged.md (not this run); docs already passed critique.
Spec (what the human asked; run.md *Request* and *Scope additions*): per-turn `threshold` log line carries the window and its source (`window=`, `windowSource=`, `basis=`), Claude Code's own window source (`hostWindowSource=` from `$.session.usage({breakdown:'summary'})` `breakdown.autocompactSource`) and `autoCompactThreshold=`; breakdown requested only when the line is written, degrading to `none`; `via` last; default 500000 unchanged; corrected fallback message (handoff waits for auto-compact — human accepted by proceeding; flag if wrong).
Standards: .claude/rules/plugin-development.md, CLAUDE.md; host types .scratch/window-observability/tc/claude-code.d.ts (2.1.306).
Evidence: hand-backs 1.1, 1.l1, 2.2, 2.2.l1 in this folder. sqa-engineer note: hostFields logs any finite number incl. negatives/0 — judge it.
Checks (orchestrator): plugin test 237/0; build --check up to date; repo tests 314/0; validate --strict both passed (1.l1).
Return the compact format with both axes, verdict approved | changes-requested; first line `handoff 3-orchestrator-to-code-reviewer.handoff.md: passed|failed — <why>`.
