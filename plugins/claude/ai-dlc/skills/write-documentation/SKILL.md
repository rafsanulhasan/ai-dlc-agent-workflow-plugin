---
name: write-documentation
description: Structured documentation writing workflow for software projects. Writes or updates README.md files at the repo root and in each project directory (src/, tests/, samples/, etc.) based on current implementation, ADRs, and architecture decisions.
---

# Write Documentation

Writes and maintains README.md files throughout the project's repository. Invoked by **Daniele Procida** (`documentation-writer`) whenever documentation needs to be created, updated, or brought into sync with the current implementation.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

---

## Phase 0 — Context Load (silent)

1. Read the root `CLAUDE.md` and `AGENTS.md`
2. Invoke `Skill("ai-dlc:manage-memory", args: "documentation-writer")` to load persistent memory
3. Read any previously identified documentation gaps or notes from memory

---

## Phase 1 — Discover Scope

Identify which README.md files need to be created or updated:

1. Glob `**/README.md` across the repository to find existing documentation
2. Glob `src/**/`, `tests/**/`, `samples/**/` to identify project and module directories without README.md files
3. Check `docs/architecture/decisions/` for new or updated ADRs since last documentation pass
4. Check `docs/backlog/backlog.md` for recently completed items that affect public APIs or behavior
5. Read the status of each feature in scope from the run that builds it: the *Stages* table and `status` of its current run state (default `docs/handoffs/<run>/`: the highest `run.v<version>.md`, or `run.md` in a run from before versions). The backlog item's `Status` counts only for work no run records. A *Docs update* request names the status; check it against the run state anyway. The run state always wins.
6. Produce a scope list: `[create | update] <path>/README.md — <reason> — <planned | in progress | done>`

---

## Phase 2 — Gather Context

For each README.md in scope:

1. Read the relevant source files in the target directory (source files, project or package manifests such as `.csproj` or `package.json`, and configuration such as `appsettings*.json` or `.env.example`)
2. Read all ADRs in `docs/architecture/decisions/` that relate to the component
3. Read `docs/backlog/backlog.md` for feature descriptions and acceptance criteria
4. Read existing README.md (if updating) to identify what sections need to change
5. Identify public API surface: public classes, interfaces and functions, module exports, extension methods, middleware registrations, endpoint filters

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

Minimal setup steps: package reference or install command, DI registration, middleware registration.

## Usage

Code examples showing the primary use cases, in fenced code blocks in the component's language.

## Configuration

Document all configurable options, their types, defaults, and effects.

## Contributing

Link to root CONTRIBUTING.md or describe component-specific contribution notes.
```

Rules:
- Use ATX headings (`#`, `##`, `###`) — never Setext
- Use fenced code blocks with language identifiers (` ```csharp `, ` ```ts `, ` ```json `, etc.)
- Use relative links for cross-references within the repo
- Never expose internal implementation details not reflected in the public API
- Keep README.md files in sync with actual code structure — no aspirational documentation
- Status markers (the documentation rule, `docs-status`, installed by `init`): *planned* for accepted work whose building stage has not started, in the future tense; *in progress* from the moment the building stage starts until the run's last review or gate stage (never the release or its go / no-go gate) is `done` (a done build with reviews pending, or a fix round, stays *in progress*), describing only what exists and what is not done yet; no marker once that last review or gate stage is `done` or the run closes `done`, described as it is. Never call something planned while an agent builds it or its reviews are pending, and never describe planned or in-progress behaviour as if it shipped. Cancelled work is not described. Use the document's existing marker form; with none, `(planned)` or `(in progress)` after the heading

---

## Phase 4 — Validate

After drafting, verify each README.md:

1. All public classes and interfaces mentioned in source files appear in the Usage or Overview section
2. All middleware pipeline registration steps are documented in Getting Started
3. All configurable options found in source code appear in the Configuration section
4. No broken relative links
5. Fenced code blocks compile against the current public API (verify method names and types match source)
6. Every status marker matches the run state (the backlog only for work no run records); a feature keeps *in progress* while any review or gate stage of its run is open, and has no marker left once the last one is `done`
7. Flag any undocumented public APIs as TODOs for the documentation-writer agent memory

---

## Phase 5 — Save Memory

Invoke `Skill("ai-dlc:manage-memory", args: "save documentation-writer ...")` with:
- Which README.md files were created or updated
- Any public APIs that were flagged as undocumented
- Patterns or conventions discovered during this documentation pass
