---
name: instruction-import-support
description: Which hosts expand @path imports in rule/instruction files (Claude Code, Copilot CLI, VS Code) and how Copilot loads dirs; checked 2026-11-14 for handoff 8.1.5
metadata:
  type: reference
---

- Claude Code memory docs (code.claude.com/docs/en/memory) document `@path` imports for CLAUDE.md only: relative to the importing file, max 4 hops, external-path approval dialog, skipped in code spans. The docs do not say rule files support them. GitHub issue anthropics/claude-code#66027 (closed not planned, stale) shows an `@../../docs/x.md` in a `.claude/rules/` file IS inlined, but eagerly at session start, ignoring `paths:` scope. No dot-folder target tested anywhere.
- Rule frontmatter: `paths` is the only field Claude reads; rules without `paths` load at launch.
- Copilot CLI (docs.github.com .../copilot-cli/customize-copilot/add-custom-instructions): `@relative/path` expands only in copilot-instructions.md, AGENTS.md, CLAUDE.md (repo-confined, no absolute or ~); NOT in `*.instructions.md` or GEMINI.md. `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` (comma list) adds AGENTS.md and `*.instructions.md` from those dirs; recursion and applyTo handling there undocumented; subagents do not inherit it. CLI does not list `.claude/rules`.
- VS Code: markdown links in instructions are not guaranteed loaded (`chat.includeReferencedInstructions` off by default, Local harness); `chat.instructionsFilesLocations` is a folder-to-bool map, defaults include `.github/instructions` and `.claude/rules`, exact format for arbitrary dot-folders undocumented; Copilot CLI/app do not inherit it.

Why: decides whether `.claude/rules` and `.github/instructions` can be pointer stubs to a standards folder.
How to apply: re-check version-dependent docs before reuse; see [[standards-and-rule-twins]] for sync-harness drift rules.
