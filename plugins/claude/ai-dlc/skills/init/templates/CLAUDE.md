# {{PRODUCT}}

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md). Read it first.

## Commands

- `{{BUILD_CMD}}` — build
- `{{TEST_CMD}}` — run tests
- `{{MUTATION_CMD}}` — run mutation tests

## Watch out for

- Run tests after every functional change; run mutation tests after tests pass.
- Artifact-only changes (agents, skills, hooks, prompts, rules, planning) may skip both gates.
