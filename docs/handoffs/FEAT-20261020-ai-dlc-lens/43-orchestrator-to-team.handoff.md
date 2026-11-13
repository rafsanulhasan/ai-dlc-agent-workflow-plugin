---
run: FEAT-20261020-ai-dlc-lens
step: 43
from: orchestrator
to: team
mode: team
lifecycle: AAWP (entered at change; requirements are the human's, research done)
kind: handoff (agent team with an engineering lead and an SQA lead, each running parallel subagents)
date: 2026-10-26
branch: feat/ai-dlc-lens
---
# Step 43 (run.v4.md 2cq-2cs)

Requirements: `43-requirements.human.md` (parts A, B, C and "Human's answers"; binding). Research: `43.1.1-`, `43.1.2-`, `43.1.3-research-assistant-to-orchestrator.handback.md`. Base: 1302cd4.

## Team
| Name | Agent | Role | Load skills |
|---|---|---|---|
| `am-43` | agent-manager | **Engineering lead.** Writes a short design note first (`43.2-design.md`: the new view state — per-site band/panel list|workflow mode, list-only panel, mode-aware restore, avatar/arrow routing, how the panel's opening source sets its mode; the status fixes), then splits the build and spawns **parallel subagents** (`ai-dlc:agent-manager`), at least: L1 lens view state + controls + commands (A1, B1-B6), L2 lens status bugs (C1), L3 lens layout (C2, C3), K1 keep-alive (A2: command opens the band minimised, a ⤢/maximise control on keep-alive's band that opens its panel). Files overlap in `register.tsx`: give each subagent a disjoint part or its own worktree and merge; the lead integrates, runs every check and owns the result. | ai-dlc:handoff, ai-dlc:agent-management, ai-dlc:skill-management |
| `sqa-43` | sqa-engineer | **SQA lead.** Spawns **parallel test subagents** (`ai-dlc:sqa-engineer`) per area (L1, L2, L3, K1), each updating the tests the change breaks and adding tests per requirement; for C1, tests that reproduce sticky halted, pending-beats-completed and a second session going stale. Integrates, runs every suite, writes the records. | ai-dlc:handoff, ai-dlc:write-tests, ai-dlc:design-test-cases |
| `cr-std-43` | code-reviewer, standards | code review | ai-dlc:handoff, ai-dlc:review |
| `cr-spec-43` | code-reviewer, spec | code review against `43-requirements.human.md` | ai-dlc:handoff, ai-dlc:review |
| `dw-43` | documentation-writer | READMEs for step 43, and drop the step-42 *in progress* markers (step 42 reviews are done, run.v4.md 2cp) | ai-dlc:handoff, ai-dlc:write-documentation |
| `bc-43` | brutal-critique | critique of every doc changed in step 43 | ai-dlc:handoff |

## Flow
1. `am-43`: design note, then parallel build; checks: both `plugin test`, both `plugin validate --strict`, `node --test "tests/**/*.test.mjs"`, `node tools/build-copilot.mjs --check`, sync-harness --check. Then `43.2-agent-manager-to-sqa-engineer.handoff.md` (what changed, path:line, per requirement), message `sqa-43` and `dw-43`.
2. `sqa-43`: parallel tests; findings to `am-43`; when green `43.3-…handback.md`, `43.4.1-`/`43.4.2-…handoff.md`, start both reviewers.
3. `dw-43`: after `am-43` says its doc edits (skills, MANUAL-CHECKS, ATTRIBUTION) are done, writes READMEs (*in progress* for step 43), then `43.5-…handoff.md` to `bc-43` listing ALL step-43 docs, `am-43`'s included.
4. Reviewers/critic: findings straight to the owner; approve at zero Blockers; limits (rounds --json AAWP) 2 rounds / 1 failure each; used up with findings open → tell the lead.
5. When everything approves, the lead asks the human to reload and check live before committing.

## Records and rules
As in `41-orchestrator-to-team.handoff.md`. Subagents report to their lead; leads write the team records (nested spawn records go under the lead's step, `43.2.<n>` / `43.3.<n>`). Questions about intent go to the lead (`main`), never to the human. Nobody commits or pushes. Keep reports short.
