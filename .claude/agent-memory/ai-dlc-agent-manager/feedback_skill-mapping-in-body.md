---
name: skill-mapping-in-body
description: Agent-to-skill mapping goes in each agent's body `## Skills` section, never a `skills:` frontmatter field
metadata:
  type: feedback
---

Map skills to agents only in the agent body's `## Skills` section (one line on when, plus a `Skill("ai-dlc:<name>")` example). Never add a `skills:` frontmatter field.

**Why:** `skills:` frontmatter preloads the full skill text into the agent's context on every spawn (user decision, 2026-10-10).

**How to apply:** When adding or changing which skills an agent uses, edit the body section, and ask `documentation-writer` (a *Docs update* request in the hand-back, [[docs-written-by-documentation-writer]]) to bring the skill → agent matrix in `docs/plugins.md` in sync. Read-only users (e.g. brutal-critique) are told to read a skill's standard, not run its workflow.
