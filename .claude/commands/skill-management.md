---
description: Creates, updates, and lists agent definitions, skill files, and command files for the AI-DLC Agent Workflow multi-agent system. Invoked by the skill-manager agent. Modes — list, create-agent, update-agent, create-skill, update-skill.
---

Skill used by the agent-manager agent to scaffold and maintain the multi-agent system. Validates frontmatter schema on every write and ensures all new skills include a Phase 0 context-load pattern.

Every other agent must route agent/skill creation and modification through `Agent("agent-manager", ...)` rather than editing these files directly.
