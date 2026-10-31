---
run: FEAT-20261020-ai-dlc-lens
work-item: none
lifecycle: AAWP (entered at change; the requirements are the human's)
step: 44
from: orchestrator
to: team
mode: team
loop: none
gate: none
verification: pending
date: 2026-10-31
branch: feat/ai-dlc-lens
---

# Step 44 orchestrator → team: live findings after step 43 (R44.1 to R44.5)

## Goal
Fix the four bugs the human found at the step 43 live check, as an agent team: the keep-alive status line, the button and status rule of the keep-alive rows and head row, the duplicate lens band, and the lens showing an active run as completed. Done means all five requirements are met, the tests prove each one, both review axes approve, the critique passes, and then the human's live check.

## Artifacts
- `docs/handoffs/FEAT-20261020-ai-dlc-lens/44-live-findings.human.md`: the human's message verbatim, what the screenshots show, and requirements **R44.1 to R44.5 (binding)**. Read it first.
- Base: the commit that holds step 43 (HEAD at team start, on `feat/ai-dlc-lens`). Step 43's records: `43-live-findings-3.md` and the `43.4.l1.*` records (the keep-alive band, pane and Ping now; the lens narrow and wide seats).
- Run state: `docs/handoffs/FEAT-20261020-ai-dlc-lens/run.v4.3.md`. The team lead (`main`, the orchestrator) keeps it.
- Code: `plugins/claude/ai-dlc/hooks/keepalive/` (panel.tsx, keepalive.ts, cache-state.ts: the band, the pane, the status line), `plugins/claude/ai-dlc-lens/hooks/` (register.tsx, lens.ts: bands and run status).

## Decisions so far
- The status-line summary (decided 2026-10-25) is dropped: R44.1. Label rule D10 is replaced by R44.2 and R44.3.
- `--session` with `--for` stays as built (2026-10-31).

## Team
| Name | Agent | Role | Load skills |
|---|---|---|---|
| `am-44` | agent-manager | Builds R44.1 to R44.5. For R44.4 and R44.5, finds the cause first and states it with path:line; an unconfirmed cause is said to be unconfirmed. Records the change in both ATTRIBUTION.md files and MANUAL-CHECKS (live rows for each requirement), runs `node tools/build-copilot.mjs`, then every check below. Edits no README and no test. | ai-dlc:handoff, ai-dlc:agent-management |
| `sqa-44` | sqa-engineer | Updates the tests the change breaks, and adds tests per requirement (R44.4: exactly one band after `/ai-dlc:lens` in the narrow view; R44.5: an active run and a blocked run never read completed, with the newest run-state version winning). Proves each new test red against a hand mutation and restores the files. Findings go to `am-44`. | ai-dlc:handoff, ai-dlc:write-tests, ai-dlc:ts-unit-testing |
| `cr-std-44` | code-reviewer, standards | code review (axis: standards, format: compact) | ai-dlc:handoff, ai-dlc:review |
| `cr-spec-44` | code-reviewer, spec | code review against R44.1 to R44.5 (axis: spec, format: compact) | ai-dlc:handoff, ai-dlc:review |
| `dw-44` | documentation-writer | READMEs for step 44 (*in progress*: keep-alive README, the status line and the buttons; lens README if the band text changes). Also removes the step 43 *in progress* markers, because step 43's reviews are done (run.v4.3.md 2en, 2eo); plugin-level markers stay while the run is active. | ai-dlc:handoff, ai-dlc:write-documentation |
| `bc-44` | brutal-critique | critique of every doc changed in step 44: READMEs, and `am-44`'s skills, MANUAL-CHECKS and ATTRIBUTION | ai-dlc:handoff |

## Flow
1. `am-44` builds, then runs and quotes these checks with their real output: `npx @anthropic-ai/claude-code plugin test ./plugins/claude/ai-dlc` and `./plugins/claude/ai-dlc-lens`; `npx @anthropic-ai/claude-code plugin validate --strict` for `./plugins/claude/ai-dlc`, `.` and `./plugins/claude/ai-dlc-lens`; `node --test "tests/**/*.test.mjs"`; `node tools/build-copilot.mjs --check`; `node .claude/scripts/sync-harness.mjs --check`. Then it writes `44.2-agent-manager-to-sqa-engineer.handoff.md` (what changed, path:line, per requirement, and the cause found for R44.4 and R44.5) and messages `sqa-44` and `dw-44`.
2. `sqa-44` tests. When green, it writes `44.3-sqa-engineer-to-agent-manager.handback.md` (the counts quoted), then `44.4.1-` and `44.4.2-sqa-engineer-to-code-reviewer.handoff.md`, and starts both reviewers.
3. `dw-44`, after `am-44` says its doc edits are done, writes the READMEs, then sends `44.5-documentation-writer-to-brutal-critique.handoff.md` to `bc-44`. That record lists every step-44 doc, `am-44`'s included.
4. Reviewers and critic send their findings straight to the owner (code to `am-44`, tests to `sqa-44`, READMEs to `dw-44`). They approve at zero Blockers (critique: PASS). Fix rounds are `44.<phase>.l1.<round>`. Limits: 2 rounds / 1 failure for each review step (`rounds --json` AAWP). When a limit is used up with findings open, tell the lead (`main`). Never ask the human.
5. When everything approves, each member tells the lead. The lead asks the human to reload and check live before anything is committed.

## Records and rules
- The sender writes each handoff, and the receiver writes its hand-back (`handoff`, *Who writes what*, agent team). Members without Write (`cr-std-44`, `cr-spec-44`) send their report, and the member who handed off to them stores it.
- Every report's line 1 is `handoff <file>: passed|failed — <why>`. Tell the lead the name of every record you write.
- Questions about intent go to the lead (`main`), never to the human.
- Nobody commits or pushes. Scratch files go in `.scratch/44-<name>/`. Keep reports short (path:line, one finding per line).
