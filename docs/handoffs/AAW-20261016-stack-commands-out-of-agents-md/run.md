---
work-item: AAW-20261016-stack-commands-out-of-agents-md
lifecycle: AAW
status: done
branch: docs/stack-commands-out-of-agents-md
updated: 2026-10-16
---

# Run state: AAW-20261016-stack-commands-out-of-agents-md

## Request
"all stack specific CLI commands, like `dotnet test` should reside either in claude.md or .github/copilot-instructions.md but not in agents.md"

## Clarified intent
AGENTS.md (generated for target repos by `/ai-dlc:init`, and this repo's own AGENTS.md) stays stack-neutral: no stack-specific CLI commands (build/test/mutation commands such as `dotnet test`, `npm test`, `node --test`, `dotnet stryker`). Those commands live in CLAUDE.md (Claude) and .github/copilot-instructions.md (Copilot). AGENTS.md may point to those files for "the project's build and test commands".

## Routing Plan row
| ID | Type | Workflow | Agent chain |
|---|---|---|---|
| AAW-20261016-stack-commands-out-of-agents-md | Agent Artifact | AAW | agent-manager → brutal-critique (docs) / sqa-engineer → code-reviewer (code) |

## Stages
| # | Stage | Agent | Status | Hand-back | Verification |
|---|---|---|---|---|---|
| 1 | Change | agent-manager | done (round 1) | 01-agent-manager-handback.md | build --check OK; node --test 134/134; validate OK; AGENTS.md greps clean |
| 2 | Review (docs) | brutal-critique | done (round 1, PASS, 6 Minors) | 02-brutal-critique-handback.md | |
| 3 | Review (code) | sqa-engineer → code-reviewer | skipped (no code paths) | | |

## Gates
AAW has no gates.

## Open clarifications
none

## Next action
Closed after round 1 (PASS). Open for human: Q1 plugin-tooling commands in AGENTS.md; Q2 AGENTS-only providers; optional follow-up for the Minors.
