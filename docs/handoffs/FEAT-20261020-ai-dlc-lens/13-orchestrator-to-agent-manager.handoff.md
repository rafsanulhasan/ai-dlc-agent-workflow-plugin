---
run: FEAT-20261020-ai-dlc-lens
work-item: ITEM-027, ITEM-028, ITEM-029
lifecycle: AI-DLC
step: 13
from: orchestrator
to: agent-manager
mode: subagent
loop: none
gate: none
verification: passed
date: 2026-10-23
---

# 13 orchestrator → agent-manager: bring the three spike plugins into the branch for the human's manual check

## Goal
The human asked (2026-10-23): "bring those changes in the branch so that i can directly check it". Put the spike plugins of steps 12.1–12.3 into the `feat/ai-dlc-lens` branch, so the human can check out the branch and install them straight from it for the manual VS Code checks before G2.

## Artifacts
- `12.1-agent-manager-to-orchestrator.handback.md` — spike 027, files under `E:\Projects\personal\ai-dlc-agent-workflow-plugin\.scratch\ai-dlc-lens\spikes\027\` — verified: files exist
- `12.2-agent-manager-to-orchestrator.handback.md` — spike 029, under `...\spikes\029\` — verified
- `12.3-agent-manager-to-orchestrator.handback.md` — spike 028 (two plugins `spike028-ka`, `spike028-lens`), under `...\spikes\028\` — verified
- Worktree `E:\Projects\personal\ai-dlc-agent-workflow-plugin\.worktrees\ai-dlc-lens`, branch `feat/ai-dlc-lens` @ `723b9a8`; `spikes/` does not exist there and is not gitignored — verified

## Acceptance criteria covered
| AC | Where |
|---|---|
| 1. Each spike plugin is copied to `spikes/ai-dlc-lens/<id>/` in the worktree (028's two plugins as `spikes/ai-dlc-lens/028/spike028-ka/` and `.../028/spike028-lens/`), source, tests, types, assets and `CHECK.md` only | file list |
| 2. Not copied: `logs/`, `results/`, `.tsc/*.jsonl`, `.tsc/headless.err`, `*.bak`, `state/`, any debug or transcript output, `GATE-ALERT.txt` / `flags.json` runtime toggles if they are generated at run time (keep them only if the plugin needs them present to load) | file list |
| 3. One local marketplace at `spikes/ai-dlc-lens/.claude-plugin/marketplace.json` lists all four spike plugins (027, 029, spike028-ka, spike028-lens); any per-spike marketplace file that conflicts is removed from the copy | `claude plugin validate spikes/ai-dlc-lens` passes |
| 4. Each copied plugin still validates and its tests still pass from the new location (`claude plugin validate`, `claude plugin test`) | real output |
| 5. Each `CHECK.md` uses the new paths: install from the branch with `claude plugin marketplace add <worktree>\spikes\ai-dlc-lens` + `claude plugin install <name>@<marketplace> --scope user` + `/reload-plugins` as the main route, `claude --plugin-dir` for the terminal, and the `CLAUDE_CODE_PLUGIN_DIRS` route only as an alternative that the human sets and removes; plus teardown (uninstall + marketplace remove) | `CHECK.md` |
| 6. `spikes/ai-dlc-lens/README.md`: what the folder is (throwaway spikes for FEAT-20261020-ai-dlc-lens, deleted before the lens PR merges), install-all steps, the order of checks, where to record results | file |
| 7. Repository checks unaffected: `node tools/build-copilot.mjs --check`, `node .ai-dlc/workflow.mjs validate`, `npx @anthropic-ai/claude-code plugin validate --strict .` and `node --test "tests/**/*.test.mjs"` pass | real output |
| 8. Nothing contains secrets, tokens, or personal data (user-profile paths like `C:\Users\<name>` → use relative or placeholder paths) | grep result |

## Gate evidence
- Build: `build-copilot --check` up to date at `14c9e79`; Tests / Review: n/a; Gate: none (G2 next)

## Decisions so far
- Spikes stay throwaway: committed only so the human can check them from the branch; they are deleted before the lens PR leaves draft. Not an AAW change (no review), as for step 12.
- Do not touch `plugins/`, `tools/`, `tests/`, `.claude/`, `.github/`, `.ai-dlc/` or root marketplaces; do not edit `~/.claude/settings.json`.

## Suggested skills
- `plugin-authoring` — mod plugin layout, local marketplace
- `plugin-management` — this repository's validate/build setup

## Instructions for the receiver
Do the copy and edits above in the worktree. Do **not** commit — the orchestrator verifies and commits. Leave `.scratch/` as it is.

Deliverable — compressed report to the orchestrator: line 1 `handoff 13-orchestrator-to-agent-manager.handoff.md: passed|failed — <why>`; then the copied file list (grouped per spike), the excluded files, one line per check in AC 4 and AC 7 with its real result, the marketplace name and the exact install commands, then `Changed paths:` (each `code` or `docs`), `Intent:`, `Checks:`. Next hop: orchestrator commits and pushes; the human runs the checks.
