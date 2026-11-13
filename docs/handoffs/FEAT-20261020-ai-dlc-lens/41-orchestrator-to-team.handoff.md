---
run: FEAT-20261020-ai-dlc-lens
step: 41
from: orchestrator
to: team
mode: team
lifecycle: AAWP (entered at change; intent, design and LLD exist: S1 gate 077d96f)
kind: handoff (agent team: test, review, docs, critique and fixes for steps 37-40)
date: 2026-10-25
branch: feat/ai-dlc-lens
---
# AAWP agent team for steps 37-40 (human, 2026-10-25, run.v4.md 2br)

Human, after `/reload-plugins` at 79139d2: "nothing is working as expected. run the full AAW workflow in agent teams so that SQA can check and BC can critique." This lifts the low-budget mode for this work. Every member can message every other by name; the lead (`main`) keeps the run state, relays the human's observations, and commits at the end.

## Change set
`git diff fe7ec7c..HEAD` (steps 37-40). Hand-backs: `37-`, `38-`, `39-`, `40-…handback.md` in this folder. Requirements: `docs/plans/tier-1-sprint-1.tasks.md` §12, the stories, spec and LLD the tasks cite (T22.a-g, T17.3, T17.6, T17.7, T20.3b, T20.3c, T20.6, T17.5), plus step 40's three fixes (`40-orchestrator-to-agent-manager.handoff.md`).

## Team
| Name | Agent | Stage | Load skills |
|---|---|---|---|
| `am-41` | agent-manager | change (fixes) | ai-dlc:handoff, ai-dlc:agent-management, ai-dlc:skill-management |
| `sqa-41` | sqa-engineer | test | ai-dlc:handoff, ai-dlc:write-tests, ai-dlc:design-test-cases |
| `cr-std-41` | code-reviewer, axis standards | code-review | ai-dlc:handoff, ai-dlc:review |
| `cr-spec-41` | code-reviewer, axis spec | code-review | ai-dlc:handoff, ai-dlc:review |
| `dw-41` | documentation-writer | docs | ai-dlc:handoff, ai-dlc:write-documentation |
| `bc-41` | brutal-critique | critique | ai-dlc:handoff |

## Flow
1. `sqa-41` starts now: run every test command; trace each AC of the tasks above to a test; write the missing tests (Cache Lab, diagrams incl. the LLD's pixel/offline/no-remote-host tests, the `handoff.onWhenOff` trust gate, step 40's fixes, the README pin test's `PENDING_DOCS` rows once `dw-41` lands the docs); check the two failing repo tests. Every failure is a finding (severity, path:line) sent straight to `am-41` (code) or `dw-41` (README). Re-test after each fix. When green, write `41.4.1-` and `41.4.2-sqa-engineer-to-code-reviewer.handoff.md` and start both reviewers.
2. `am-41` fixes code findings from anyone; reruns `plugin test` for the changed plugin(s), both `plugin validate --strict`, `node tools/build-copilot.mjs --check`; messages the finder back. Only `am-41` changes plugin code; only `sqa-41` changes tests; only `dw-41` changes READMEs.
3. `dw-41` starts now: step 40's Docs update (keep-alive README: hidden while the master is off; `on|off [--track]` writing `.claude/settings.local.json`), the README side of "the README names every gated setting" if it is a README gap; then hands every doc changed in steps 37-40 (READMEs, skills, MANUAL-CHECKS, ATTRIBUTION, NOTICE, THIRD_PARTY_NOTICES) to `bc-41` (`41.5-documentation-writer-to-brutal-critique.handoff.md`). Status: steps 37-40 *in progress* until the last review here is `done`; then the lead tells `dw-41` to drop the markers.
4. `bc-41` critiques (PASS / REVISE) and sends findings to `dw-41` (READMEs) or `am-41` (skills, ATTRIBUTION, notices, MANUAL-CHECKS).
5. Reviewers approve only at zero Blockers; findings go straight to the fixer, then re-review.
6. Limits (rounds --json, AAWP): test, code-review, critique each 2 rounds / 1 failure. When one is used up with findings open, stop and tell the lead; the human decides.

## Records (team rules, `handoff` *Who writes what*)
Sender writes the handoff, receiver the hand-back; `code-reviewer` and `brutal-critique` have no Write for records only if their tools say so: then the sender stores the report verbatim. Every record `mode: team`, line 1 `handoff <path>: passed|failed — <why>`. Codes: tests `41.3`, reviews `41.4.1` / `41.4.2`, docs `41.5`, critique `41.6`, fix rounds `41.<n>.l1.<round>`. Tell the lead each record name in one line. Only the lead writes run.v4.md.

## Rules
Never ask the human directly; questions go to the lead. Nobody commits or pushes (the lead commits at the end). Never write `.ai-dlc/cache-keepalive.json` (the human's) or `.claude/agent-memory/ai-dlc-orchestrator/`. Keep reports short. Scratch: `.scratch/41/`.
