---
run: AAW-20261023-keepalive-own-folder
work-item: none
lifecycle: AAW
step: 3
from: orchestrator
to: brutal-critique
mode: subagent
loop: none
gate: none
verification: pending
date: 2026-10-23
---

# 3 orchestrator → brutal-critique: docs for the move to hooks/keepalive/ and the four fixes

## Goal
Give a PASS or REVISE verdict on the docs changed in steps 1 and 2.1. Every path must point at `plugins/claude/ai-dlc/hooks/keepalive/`. The attribution split must be clear. The four fixes must be described accurately: 16 gated keys, the `key=value` log with 40-character truncation, and the seed-line error guard.

## Request
The human asked for keep-alive in `hooks/keepalive/`, not `hooks/auto-handoff/keepalive/`, and for four leftover notes to be fixed. See `run.md` (*Request*, *Clarified intent*).

## Artifacts (docs)
- `plugins/claude/ai-dlc/hooks/keepalive/README.md` (moved; "16 settings" and the trust paragraph)
- `plugins/claude/ai-dlc/hooks/keepalive/ATTRIBUTION.md` (new; the former cache-keepalive section, an old-paths note, a Moved row, a 2026-10-23 entry)
- `plugins/claude/ai-dlc/hooks/keepalive/LICENSE` (byte-identical, verified)
- `plugins/claude/ai-dlc/hooks/auto-handoff/ATTRIBUTION.md` (link at lines 5-9, plus a 2026-10-23 entry)
- skills: `configure-auto-handoff`, `init`, `keepalive`, and `plugin-management` (2.1: lines 31-34 and 75)
- `plugins/claude/ai-dlc/.claude-plugin/plugin.json` (descriptions: 39 path mentions, and the gate sentence on the 3 price rows)
- repo root: `CLAUDE.md`, `README.md`, `THIRD_PARTY_NOTICES.md`, `.claude/rules/plugin-development.md`
- memory: `.claude/agent-memory/ai-dlc-agent-manager/reference_hooks-module-typecheck.md`

Context:
- `1-agent-manager-to-orchestrator.handback.md`, `2.1-agent-manager-to-orchestrator.handback.md`
- the previous run's last critique, `../AAW-20261022-fold-cache-keepalive/6.l2-brutal-critique-to-orchestrator.handback.md`, and its trust wording (closed in `4.l3`)

Diff: `git diff HEAD -M -- <path>` (renames from `hooks/auto-handoff/keepalive/`).

## Gate evidence (orchestrator re-run)
- build `--check` → up to date
- both validations → passed
- repo tests → 329/329
- `plugin test` → 409/409
- the Copilot plugin has no `hooks/`

## What to check
1. No doc in the Claude plugin, the repo docs or the rules still points at `hooks/auto-handoff/keepalive/`, except as clearly labelled history.
2. The attribution split: the keep-alive history lives in `hooks/keepalive/ATTRIBUTION.md`, and the auto-handoff one links to it with nothing duplicated or lost.
3. The README and `plugin.json` say "16" gated keys and list `writeMult`, `outputMult` and `readPrice`.
4. The `key=value` log is described accurately: 40-character cut with `…` and `(N chars)`, unredacted. State the risk that unredacted text can appear in the log, if the docs don't.
5. The trust-surface wording from the previous run is intact: terminal records trust; `-p` and SDK, as an inference, never do; VS Code, JetBrains and Desktop are unverified or undocumented.

## Instructions for the receiver
Read-only. Return:
- Line 1: `handoff 3-orchestrator-to-brutal-critique.handoff.md: passed|failed — <why>`
- findings, one per line with `path:line`
- `verdict: PASS | REVISE`
