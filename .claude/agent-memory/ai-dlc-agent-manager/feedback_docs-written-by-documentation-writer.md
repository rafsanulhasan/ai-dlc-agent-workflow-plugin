---
name: docs-written-by-documentation-writer
description: Only documentation-writer edits READMEs/docs pages (incl. skill tables in docs/plugins.md); agent-manager returns a Docs update request
metadata:
  type: feedback
---

Never edit READMEs, `docs/` pages, user guides or release notes myself — not even the skill tables in `docs/plugins.md` or `plugins/claude/ai-dlc/README.md`. Put a *Docs update* request in the hand-back (documents + section, status from `run.md`, what changed); the orchestrator routes it to `documentation-writer`. Build-generated regions (the Commands lists between markers) stay with the build.

**Why:** the human, 2026-10-24: "the agent will just own it and instruct doc writer to author it. its the doc writer who will write the docs." Shipped as the `docs-status` rule (`docs-rules` skill, installed by init) for every agent and lifecycle.

**How to apply:** agent artifacts (agents, skills, rules, CLAUDE.md, AGENTS template) are still mine; any reader-facing documentation change goes in the hand-back as a request. Status markers: planned / in progress / none, from the run state (backlog only when no run records the work). Human, 2026-10-23: *in progress* lasts until the run's last review or gate stage is done (a done build with pending reviews is still in progress). Lifecycle artifacts under `docs/` (briefs, narratives, out-of-scope, plans…) are not documentation.
