---
name: write-documentation
description: Structured documentation writing workflow for software projects. Writes or updates README.md files at the repo root and in each project directory (src/, tests/, samples/, etc.) based on current implementation, ADRs, and architecture decisions.
---

# Write Documentation

Writes and maintains README.md files throughout the project's repository. Invoked by **Daniele Procida** (`documentation-writer`) whenever documentation needs to be created, updated, or brought into sync with the current implementation.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `AGENTS.md`
2. Invoke `Skill("ai-dlc:manage-memory", args: "documentation-writer")` to load persistent memory
3. Read any previously identified documentation gaps or notes from memory

---

## Phase 1 — Discover Scope

Identify which README.md files need to be created or updated:

1. Glob `**/README.md` across the repository to find existing documentation
2. Glob `src/**/`, `tests/**/`, `samples/**/` to identify project and module directories without README.md files
3. Check `docs/architecture/decisions/` for new or updated ADRs since last documentation pass
4. Check `docs/backlog/backlog.md` for recently completed items that affect public APIs or behavior
5. Produce a scope list: `[create | update] <path>/README.md — <reason>`

---

## Phase 2 — Gather Context

For each README.md in scope:

1. Read the relevant source files in the target directory (`.cs` files, project files, `appsettings*.json`)
2. Read all ADRs in `docs/architecture/decisions/` that relate to the component
3. Read `docs/backlog/backlog.md` for feature descriptions and acceptance criteria
4. Read existing README.md (if updating) to identify what sections need to change
5. Identify public API surface: public classes, interfaces, extension methods, middleware registrations, endpoint filters

---

## Phase 3 — Draft

Write or update each README.md following this consistent structure:

```markdown
# <Component Name>

## Overview

One-paragraph description of what this component does and why it exists.

## Architecture

Describe how this component fits into the application's pipeline. Reference relevant ADRs.

## Getting Started

Minimal setup steps: package reference, DI registration, middleware registration.

## Usage

Code examples showing the primary use cases. Use fenced C# code blocks.

## Configuration

Document all configurable options, their types, defaults, and effects.

## Contributing

Link to root CONTRIBUTING.md or describe component-specific contribution notes.
```

Rules:
- Use ATX headings (`#`, `##`, `###`) — never Setext
- Use fenced code blocks with language identifiers (` ```csharp `, ` ```json `, etc.)
- Use relative links for cross-references within the repo
- Never expose internal implementation details not reflected in the public API
- Keep README.md files in sync with actual code structure — no aspirational documentation

---

## Phase 4 — Validate

After drafting, verify each README.md:

1. All public classes and interfaces mentioned in source files appear in the Usage or Overview section
2. All middleware pipeline registration steps are documented in Getting Started
3. All configurable options found in source code appear in the Configuration section
4. No broken relative links
5. Fenced code blocks compile against the current public API (verify method names and types match source)
6. Flag any undocumented public APIs as TODOs for the documentation-writer agent memory

---

## Phase 5 — Save Memory

Invoke `Skill("ai-dlc:manage-memory", args: "save documentation-writer ...")` with:
- Which README.md files were created or updated
- Any public APIs that were flagged as undocumented
- Patterns or conventions discovered during this documentation pass
