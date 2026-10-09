---
description: Creates, updates, syncs, and deprecates agent definitions for both Claude Code (.claude/agents/*.md) and GitHub Copilot/VS Code (.github/agents/*.agent.md). Invoked exclusively by the agent-manager agent.
---

Manages the full lifecycle of agent definitions across both the Claude Code and GitHub Copilot/VS Code platforms.

Supported operations:

- **list** — display all known agents with their platform coverage and status
- **create-agent `<name>`** — scaffold a new agent on both platforms with matching definitions and an empty memory index
- **update-agent `<name>` `<change>`** — apply a change to both platform files while keeping them in sync
- **sync-agent `<name>`** — generate or refresh the Copilot agent file from the Claude agent definition
- **deprecate-agent `<name>` `<reason>`** — mark an agent deprecated on both platforms without deleting any files
