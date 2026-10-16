# {{PRODUCT}}

<!-- ai-dlc:begin pointer -->
@AGENTS.md

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md), imported above. Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`, so the import is what loads it here.
<!-- ai-dlc:end pointer -->

<!-- ai-dlc:begin commands -->
## Project commands

| Purpose | Command |
|---|---|
| Build | `{{BUILD_CMD}}` |
| Test | `{{TEST_CMD}}` |
| Mutation test | `{{MUTATION_CMD}}` |

Use these wherever `AGENTS.md` or an agent says "the project's build, test or mutation command". They live here, not in `AGENTS.md`, which stays free of stack-specific commands.
<!-- ai-dlc:end commands -->

<!-- ai-dlc:begin workspace-folders -->
## Workspace folders (Claude Code only)

- Write scratch files to `{{SCRATCHPAD_ROOT}}/<session-or-task>/` instead of Claude Code's built-in per-session scratchpad directory or the system temp directory.
- `claude --worktree`, `EnterWorktree` and agents with `isolation: "worktree"` get their worktree under `{{WORKTREE_ROOT}}/` through the `WorktreeCreate` hook in `.claude/settings.json`. Claude Code keeps the worktrees it creates for subagents; remove each with `git worktree remove` once its branch is merged.
<!-- ai-dlc:end workspace-folders -->
