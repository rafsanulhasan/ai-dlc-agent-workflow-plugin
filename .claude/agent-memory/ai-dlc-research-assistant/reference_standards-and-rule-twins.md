---
name: standards-and-rule-twins
description: specsmd standards folder shape, weighingms standards layout (no front matter, rules link direction) and how sync-harness compares rule twins (body, description, scope)
metadata:
  type: reference
---

Facts checked 2026-11-14 for feature 8 (preview2 restructure, handoff 8.1.2).

- specsmd standards live at top-level `memory-bank/standards/` (no product/project split upstream). Upstream `templates/standards/` holds `catalog.yaml` and guide files (not read in full). Confidence Medium-Low on upstream front matter: the weighingms copies have none (plain `# Title` line 1).
- weighingms `memory-bank/standards/` holds api-conventions, coding-standards, data-stack, system-architecture, ux-guide, tech-stack, decision-index (no `.md` front matter).
- weighingms direction: enforceable rules are the source in `.claude/rules/` (twins in `.github/instructions/`); `coding-standards.md` links to the rules it relies on instead of restating them. The reverse of a stub-from-standard design.
- `.claude/scripts/sync-harness.mjs` rules pair: walks `.claude/rules/**/*.md` against `.github/instructions/**/*.instructions.md`; drift = description, scope (`paths` / `globs` vs `applyTo`, `**` and `**/*` equal) or whitespace-trimmed body. Newer file wins (`--prefer`). Dot-prefixed directories are not walked. It never reads `memory-bank/`.
- Consequence for pointer stubs: a stub must be written identically to its twin, or the sync copies the full body back from the newer side.
- Plugin rule templates: `plugins/claude/ai-dlc/skills/docs-rules/templates/`, `dotnet-rules/templates/`, `node-rules/templates/`. `docs-rules` rewrites default paths when `artifacts.handoffs` or `artifacts.backlog` differ.

Why: needed to answer whether rules can become pointer stubs without breaking Claude Code / Copilot path loading.
How to apply: re-verify paths before reuse; the worktree `memory-bank/` tree may have changed since.
