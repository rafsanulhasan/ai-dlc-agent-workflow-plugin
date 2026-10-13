# {{PRODUCT}}

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md). Read it first.

## Commands

- `{{BUILD_CMD}}` — build
- `{{TEST_CMD}}` — run tests
- `{{MUTATION_CMD}}` — run mutation tests

## Workspace folders

Details in AGENTS.md "Workspace folders"; change the roots with `/workspace-folders`.

- Scratch files go in `{{SCRATCHPAD_ROOT}}/<session-or-task>/`. This root overrides Claude Code's built-in per-session scratchpad and the system temp directory.
- Worktrees go under `{{WORKTREE_ROOT}}/` (the `WorktreeCreate` hook in `.claude/settings.json` puts `--worktree` sessions there too).

## Watch out for

- Run tests after every functional change; run mutation tests after tests pass.
- Artifact-only changes (agents, skills, hooks, prompts, rules, planning) may skip both gates.
