---
name: docs-rules
description: "Installs the AI-DLC documentation rule (docs-status) into the current repository, for every stack. The rule binds every agent in every lifecycle and workflow: who writes documentation, what counts as documentation, how other agents ask for a docs update, and how the status markers are worked out; its definitions live only in templates/rules/docs-status.md. Installed as a Claude rule (.claude/rules/docs-status.md) with an identical GitHub Copilot instruction twin (.github/instructions/docs-status.instructions.md). Called by init in every repository; run it directly to add, repair or update the rule."
disable-model-invocation: true
---

# Documentation rules

These rules are stack-agnostic, so `init` installs them into every repository, whatever its stack. The files come from `templates/`.

## When to use

- `init` follows this skill in every repository (Phase 2, **Documentation rules**).
- The user asks to add, repair or update the documentation rules.

## What gets installed

| Rule | Claude (`.claude/rules/`) | Copilot (`.github/instructions/`) | Applies to |
|---|---|---|---|
| Documentation and its status: only **Daniele Procida** (`documentation-writer`) writes documentation; what counts as documentation; how and when every other agent asks for a *Docs update*; the status markers and where they come from. The definitions are in the template, not repeated here. | `docs-status.md` | `docs-status.instructions.md` | always: every agent, every lifecycle and workflow |

The rule has no `paths` (Copilot: `applyTo: "**"`), so it is loaded in every session: documentation is not one file type, and the rule binds every agent: each one must know when to ask `documentation-writer` for an update, and `documentation-writer` how to write it.

## Install

1. Write `templates/rules/docs-status.md` to `.claude/rules/docs-status.md` and `templates/instructions/docs-status.instructions.md` to `.github/instructions/docs-status.instructions.md`. Create the folders if needed.
2. When the workflow file moves the handoff folder or the backlog (`artifacts.handoffs`, `artifacts.backlog` in `.ai-dlc/workflow.json`), replace the default paths `docs/handoffs/<run>/` and `docs/backlog/backlog.md` in both files with those paths.
3. For a file that already exists and differs, show a unified diff of the proposed merge and write only with the user's consent. Never delete rules the project already has.
4. Keep the rule and its Copilot twin identical in body; only the frontmatter differs (no `paths` vs `applyTo: "**"`).

**Done when:** both files exist with identical bodies, or the user declined the diff.

## Report

List each file created, merged or left unchanged.
