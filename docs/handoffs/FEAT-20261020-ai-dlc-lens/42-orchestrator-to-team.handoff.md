---
run: FEAT-20261020-ai-dlc-lens
step: 42
from: orchestrator
to: team
mode: team
lifecycle: AAWP (entered at change; the design below is the human's, no SA/SE round)
kind: handoff (agent team: build, test, review, docs, critique)
date: 2026-10-25
branch: feat/ai-dlc-lens
---
# Step 42: two separate bands; Cache Lab in the agent panel (human, 2026-10-25, run.v4.md 2ch)

Research 42.1 (`42.1-research-assistant-to-orchestrator.handback.md`): no plugin surface exists beside the VS Code prompt row; the human chose bands.

## What to build (the human's words are binding)
1. **Two separate bands, never combined**, one after another above the prompt: first the **AI-DLC Lens** band, then the **keep-alive** band. Today auto-handoff's AbovePrompt hook draws keep-alive's rows and the lens (via `next(e)`) in one Box (`plugins/claude/ai-dlc/hooks/auto-handoff/register.tsx` ~980-990, step 40 fix 8c0a1d9). Each band is its own block with its own controls; the order is lens first, keep-alive second. Keep step 34's rule (no fixed width on the Box around core's engine node).
2. **Both minimise the same way** (same control, same behaviour).
   - Lens, minimised: as before (one line: the latest in-progress workflow with its count, else waiting/pending/halted, else "Nothing Here"; with its icons).
   - Keep-alive, minimised: whether keep-alive is on or off, and ONE button for the master switch only (on/off). Full keep-alive band: as today (title row, track rows, buttons).
   - Where the human's words leave a choice (e.g. whether the keep-alive band starts minimised), pick the simplest consistent with the lens band and note it.
3. **Cache Lab moves into the agent panel** (opened from an avatar), replacing the agent panel's "Cache Keepalive" section. It is removed from the lens view's head (T22.b put it in the pane head).
   - Inside Cache Lab: the Cache Lab figures (as built in T22.b-d), a **Keep Alive sub-accordion** with what the Cache Keepalive section showed, and **on/off buttons for all caches: Master, 1h and 5m** (same effect as the band buttons: session switches, decision 2d).
   - "Context Lab" stays as it is.

## Team
| Name | Agent | Stage | Load skills |
|---|---|---|---|
| `am-42` | agent-manager | change (builds 1-3, fixes) | ai-dlc:handoff, ai-dlc:agent-management, ai-dlc:skill-management |
| `sqa-42` | sqa-engineer | test | ai-dlc:handoff, ai-dlc:write-tests |
| `cr-std-42` | code-reviewer, axis standards | code-review | ai-dlc:handoff, ai-dlc:review |
| `cr-spec-42` | code-reviewer, axis spec | code-review | ai-dlc:handoff, ai-dlc:review |
| `dw-42` | documentation-writer | docs | ai-dlc:handoff, ai-dlc:write-documentation |
| `bc-42` | brutal-critique | critique | ai-dlc:handoff |

## Flow
1. `am-42` builds 1-3 now, updates MANUAL-CHECKS rows, skill text and ATTRIBUTION, runs both `plugin test`, both `plugin validate --strict`, `node --test "tests/**/*.test.mjs"`, `node tools/build-copilot.mjs --check`; writes `42.2-agent-manager-to-sqa-engineer.handoff.md` (what changed, path:line) and messages `sqa-42` and `dw-42`.
2. `sqa-42` updates the tests the change breaks and adds tests for 1-3 (two separate blocks in order; same minimise; keep-alive minimised content; Cache Lab in the agent panel with the Keep Alive sub-accordion and the three buttons; nothing in the view head); findings to `am-42`; when green writes `42.4.1-` / `42.4.2-sqa-engineer-to-code-reviewer.handoff.md` and starts both reviewers.
3. `dw-42` updates READMEs (lens and keep-alive band, Cache Lab placement) after `am-42`'s handoff; marks the step *in progress*; when done hands every changed doc to `bc-42` (`42.5-documentation-writer-to-brutal-critique.handoff.md`) only after `am-42` says its doc edits are done.
4. Reviewers and critic send findings straight to the owner (code `am-42`, tests `sqa-42`, READMEs `dw-42`). Approve only at zero Blockers.
5. Limits (rounds --json, AAWP): 2 rounds / 1 failure each; used up with findings open → tell the lead.
6. When all approve, `dw-42` removes the *in progress* markers for step 42 when the lead says so.

## Records and rules
As in `41-orchestrator-to-team.handoff.md` (Records, Rules): sender writes the handoff, receiver the hand-back; reviewers without Write send reports to the sender and the lead; `mode: team`; line 1 `handoff <path>: passed|failed — <why>`; tell the lead each record name; only the lead writes run.v4.md and commits. Never ask the human; questions go to the lead. Keep reports short (the human's weekly budget is low).
