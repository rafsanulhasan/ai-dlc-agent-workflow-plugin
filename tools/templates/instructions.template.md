# {{PRODUCT}}

<!-- ai-dlc:begin pointer -->
<!-- variant:claude -->
@AGENTS.md

> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](AGENTS.md), imported above. Claude Code reads `AGENTS.md` on its own only when there is no `CLAUDE.md`, so the import is what loads it here.
<!-- variant:copilot -->
> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](../AGENTS.md), which GitHub Copilot loads on its own. This file holds only the GitHub Copilot specifics.
<!-- /variant -->
<!-- ai-dlc:end pointer -->

<!-- ai-dlc:begin workspace-folders -->
<!-- variant:claude -->
## Workspace folders (Claude Code only)

- Write scratch files to `{{SCRATCHPAD_ROOT}}/<session-or-task>/` instead of Claude Code's built-in per-session scratchpad directory or the system temp directory.
- `claude --worktree`, `EnterWorktree` and agents with `isolation: "worktree"` get their worktree under `{{WORKTREE_ROOT}}/` through the `WorktreeCreate` hook in `.claude/settings.json`. Claude Code keeps the worktrees it creates for subagents; remove each with `git worktree remove` once its branch is merged.
<!-- variant:copilot -->
## Workspace folders (GitHub Copilot only)

- Load the `scratchpad` skill before writing the first scratch file; it keeps every scratch file in `{{SCRATCHPAD_ROOT}}/<session-or-task>/`.
- Copilot has no worktree location setting: create each worktree yourself with `git worktree add {{WORKTREE_ROOT}}/<slug> -b <branch>`. Worktrees VS Code creates for background agents are not placed under this root.
<!-- /variant -->
<!-- ai-dlc:end workspace-folders -->
