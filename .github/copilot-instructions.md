# AI-DLC Agent Workflow

<!-- ai-dlc:begin pointer -->
> Agent orchestration, routing, gates and memory rules live in [AGENTS.md](../AGENTS.md), which GitHub Copilot loads on its own. This file holds only the GitHub Copilot specifics.
<!-- ai-dlc:end pointer -->

<!-- ai-dlc:begin commands -->
## Project commands

| Purpose | Command |
|---|---|
| Build | `node tools/build-copilot.mjs`, then `node tools/build-copilot.mjs --check` |
| Test | `node --test "tests/**/*.test.mjs"` (quote the glob; bare `node --test` also picks up the hooks module's TypeScript tests, and `node --test tests/` fails on Node 24) |
| Mutation test | none — no mutation testing is set up for this stack |

Use these wherever `AGENTS.md` or an agent says "the project's build, test or mutation command". They live here, not in `AGENTS.md`, which stays free of stack-specific commands.
<!-- ai-dlc:end commands -->

<!-- ai-dlc:begin workspace-folders -->
## Workspace folders (GitHub Copilot only)

- Load the `scratchpad` skill before writing the first scratch file; it keeps every scratch file in `.scratch/<session-or-task>/`.
- Copilot has no worktree location setting: create each worktree yourself with `git worktree add .worktrees/<slug> -b <branch>`. Worktrees VS Code creates for background agents are not placed under this root.
<!-- ai-dlc:end workspace-folders -->
