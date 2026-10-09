---
description: Structured documentation writing workflow for AI-DLC Agent Workflow. Writes or updates README.md files at the repo root and in each project directory (src/, tests/, samples/, etc.) based on current implementation, ADRs, and architecture decisions.
---

Invoke this command to write or update README.md files throughout the AI-DLC Agent Workflow repository. The skill discovers which files need to be created or updated, gathers context from source files, ADRs, and the backlog, drafts documentation using a consistent structure (Overview, Architecture, Getting Started, Usage, Configuration, Contributing), and validates that all public APIs and middleware pipeline steps are covered.

Invokes `Skill("write-documentation")`.
