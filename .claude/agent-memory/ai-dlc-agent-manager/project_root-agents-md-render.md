---
name: root-agents-md-render
description: This repo's root AGENTS.md is a hand-rendered copy of the generated init AGENTS.md template; no tool syncs it
metadata:
  type: project
---

Root `AGENTS.md` is not generated: it is the build's `skills/init/templates/AGENTS.md` with the `{{...}}` placeholders filled by hand (product name, worktree/scratch roots, architecture notes) and the Quality gates line rewritten for this repo. No check catches drift.

**Why:** `tools/build-copilot.mjs` only renders the init template; the repo's own copy was filled once (2026-10-24 confirmed while changing the orchestrator body).

**How to apply:** after any change to `agents/orchestrator.md` or `tools/templates/AGENTS.template.md`, rebuild, then re-render root `AGENTS.md`: copy the template and keep the root's placeholder-filled lines; `diff AGENTS.md plugins/claude/ai-dlc/skills/init/templates/AGENTS.md` should then show only those lines (1, 4, Quality gates, the two workspace rows, worktree/scratch bullets, architecture notes).
