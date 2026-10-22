---
run: AAW-20261022-window-observability
status: done
lifecycle: AAW
branch: fix/auto-handoff-chain
session: 7dad6963-9400-4733-8bc7-998ae3d59007
current-stage: closed
last-record: 3-code-reviewer-to-orchestrator.handback.md
commit: bcd492f
mode: parallel subagents
---

# Run state: make the context window observable

## Request
1. Add the context window and its source to the module's per-turn `threshold` log line, so an e2e test on a 1M model shows the value Claude Code reports.
2. One-off probe: a temporary status-line command that saves its stdin JSON to `.scratch/`, so `context_window.context_window_size` can be read.
3. Document the oddity that the 500000 `defaultContextWindow` fallback matches neither documented size (200000 / 1000000) in its proper place, then remove it from `AAW-20261022-auto-handoff-chain/flagged.md` (F15).

Human confirmed by "do the following" (2026-10-22). Origin: flagged.md F15; research in `.scratch/auto-handoff-thresholds-question/`.

## Routing Plan row
| ID | Type | Workflow | Mode | Chain |
|---|---|---|---|---|
| WI-1 | Agent artifact (hooks module code + docs) | AAW | parallel subagents | agent-manager → brutal-critique (docs) ∥ sqa-engineer → code-reviewer ×2 (code) |
| WI-2 | Agent artifact (docs) | AAW, with WI-1 | same spawn as WI-1 | agent-manager → brutal-critique |
| WI-3 | Local settings probe (gitignored `.claude/settings.local.json` + `.scratch/` script), temporary, not committed | AAW change step only; no reviewer (nothing committed); orchestrator verifies | parallel with WI-1 | agent-manager |

## Stages
| Step | Stage | Agent | Status | Handoff | Handback |
|---|---|---|---|---|---|
| 1.1 | change (WI-1, WI-2) | agent-manager | done | 1.1-orchestrator-to-agent-manager.handoff.md | 1.1-agent-manager-to-orchestrator.handback.md (passed) |
| 1.2 | change (WI-3 probe) | agent-manager | done (no reviewer: local, uncommitted) | 1.2-orchestrator-to-agent-manager.handoff.md | 1.2-agent-manager-to-orchestrator.handback.md (passed) |
| 2.1 | critique (docs) | brutal-critique | done — PASS, 5 minors (round 0) | 2.1-orchestrator-to-brutal-critique.handoff.md | 2.1-brutal-critique-to-orchestrator.handback.md (passed) |
| 2.2 | test (code) | sqa-engineer | done — 4 tests added, no defects (round 0) | 2.2-orchestrator-to-sqa-engineer.handoff.md | 2.2-sqa-engineer-to-orchestrator.handback.md (passed) |
| 1.l1 | change round 1 (A1–A4, critique minors) | agent-manager | done | 1.l1-orchestrator-to-agent-manager.handoff.md | 1.l1-agent-manager-to-orchestrator.handback.md (passed) |
| 2.1.l1 | critique round 1 | brutal-critique | done — PASS, 2 optional minors | 2.1.l1-orchestrator-to-brutal-critique.handoff.md | 2.1.l1-brutal-critique-to-orchestrator.handback.md (passed) |
| 2.2.l1 | test round 1 | sqa-engineer | done — 5 tests added, no defects | 2.2.l1-orchestrator-to-sqa-engineer.handoff.md | 2.2.l1-sqa-engineer-to-orchestrator.handback.md (passed) |
| 3 | code-review (single pass, both axes — override) | code-reviewer | done — approved, 3 suggestions | 3-orchestrator-to-code-reviewer.handoff.md | 3-code-reviewer-to-orchestrator.handback.md (passed) |

## Gates and loops
AAW has no gates. Limits from `node .ai-dlc/workflow.mjs rounds --json` (2026-10-22): AAW/critique 2/1, AAW/test 2/1, AAW/code-review 2/1 (source: loop).

## Next action (updated)
Wait for 1.1 and 1.2 hand-backs; verify; then spawn reviewers by kind.

## Scope additions (human, 2026-10-22, for the fix round)
Research (.scratch/auto-handoff-thresholds-question/3-…handback.md): `$.session.usage({breakdown})` returns the /context breakdown; `context.window` is a required number (Claude Code 2.1.306 types).
- A1: log Claude Code's window source (`breakdown.autocompactSource`, ContextWindowSource) in the per-turn line, using `breakdown: 'summary'` (local estimate).
- A2: log Claude Code's `autoCompactThreshold` too.
- A3: reword the README 500k paragraph: a safety net that should not run, since the host always reports a window.
- A4: remove the status-line probe (statusLine key in .claude/settings.local.json; .scratch/window-probe/).
Also carry brutal-critique 2.1 minors 1, 2, 4.

## One-off override (human, 2026-10-22)
Code review: one `code-reviewer` pass covering both axes (standards and spec) instead of the two-axis fan-out. If it returns changes-requested, the re-review after the fix uses two passes (one per axis).

## Close (2026-10-22)
All paths clean: critique PASS (2.1, 2.1.l1), tests no defects (2.2, 2.2.l1; 237/0), code review approved (3). Rounds used: change 1, critique 1/2, test 1/2, code-review 0/2. Optional suggestions not actioned (hostFields negatives, ATTRIBUTION "(extended below)"). flagged.md: F15 narrowed to the live check; 500k and log-line items closed. Probe removed (local).
