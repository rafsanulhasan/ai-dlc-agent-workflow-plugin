---
name: vscode-plugin-reload
description: VS Code Claude extension does not list newly added/changed plugin skills or commands until VS Code is restarted
metadata:
  type: project
---

When a plugin skill or command (e.g. `/ai-dlc:init`) "is not listed" in the VS Code Claude extension, the cause was a stale extension session; restarting VS Code fixed it (2026-10-16). No plugin change was needed.

**Why:** an AAW run was opened to "create a command for init" and turned out unnecessary.
**How to apply:** before routing a "skill/command missing in VS Code" request to agent-manager, ask the human to restart VS Code and re-check first.
