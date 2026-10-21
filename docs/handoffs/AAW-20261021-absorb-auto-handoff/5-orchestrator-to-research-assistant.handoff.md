---
run: AAW-20261021-absorb-auto-handoff
work-item: WI-4
lifecycle: AAW
step: 5
from: orchestrator
to: research-assistant
mode: subagent
loop: AAW review, round 2 of 3 (parallel with 2.l1)
gate: none
verification: pending
date: 2026-10-21
---

# 5 orchestrator → research-assistant: verify the 5 claims the docs critique could not

## Goal
The round-1 critique (`3.1-brutal-critique-to-orchestrator.handback.md`, "Unverified") lists claims in the shipped docs with no source. Give each a verdict with a cited source, so round 2 can fix or keep the sentences.

## Claims (in `plugins/claude/ai-dlc/skills/handoff/SKILL.md` and root `README.md`)
1. `claude --safe-mode` and the `disableAllHooks` setting stop every plugin hooks module (SKILL.md:~341, README.md:~80).
2. Claude Code 2.1.287 is the minimum version for plugin hooks modules (`hooks/hooks.json` `modules`), and what an older version does with such a plugin (install error, or the entry silently ignored) (SKILL.md:~288, README.md:~80, ~123).
3. `claude plugin prune` exists and does what README.md:~95 says.
4. GitHub Copilot (CLI and VS Code agent hooks) exposes no context size, timer, `/clear` equivalent or model call to hooks (SKILL.md:~343). Step 1's `1-research-assistant-to-orchestrator.handback.md` was the earlier source; confirm or update it.
5. The status-line wrapper `plugins/claude/ai-dlc/hooks/auto-handoff/statusline/handoff-link.sh` requires `jq` (confirm from the script), and where an installed plugin's files live, so README can give a usable path (a `${CLAUDE_PLUGIN_ROOT}` form or the plugin cache path).

## Instructions
Read-only. Prefer the official Claude Code docs and changelog and the GitHub Copilot docs; cite URLs or `path:line`. Mark each claim confirmed / refuted / unknown, with the exact correct wording when refuted.

## Return
- Line 1: `handoff 5-orchestrator-to-research-assistant.handoff.md: passed|failed — <why>`
- One line per claim: `<n>: confirmed|refuted|unknown — <correct statement> — <source>`, with confidence. Under about 350 words.
