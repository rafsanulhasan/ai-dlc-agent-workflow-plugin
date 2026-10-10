---
name: github-ci-automation
description: Structured workflow for designing and maintaining GitHub Actions continuous integration for .NET and JavaScript/TypeScript projects. Covers workflow file structure, push/pull_request triggers, build matrix, caching, stack-specific build/lint/typecheck/test/mutation steps (dotnet build/test/stryker; npm/pnpm/yarn with StrykerJS), uploading test results and coverage artifacts, branch protection integration, and PR status checks. Invoked by the devops-engineer agent when CI workflows need to be created or updated.
---

# GitHub CI Automation

You are executing the `github-ci-automation` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to produce or modify `.github/workflows/*.yml` files that build, test, and validate the project on every push and pull request — gating merges with deterministic status checks.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Stack Detection

This file holds the stack-neutral workflow. The steps that install, build, test and mutate live in one reference per stack. Detect the stack (ignore `bin/`, `obj/`, `node_modules/`) and read the matching reference before writing any job:

| Detected | Stack | Reference |
|----------|-------|-----------|
| `*.sln`, `*.slnx` or `*.csproj` | .NET | [references/dotnet.md](references/dotnet.md) |
| `package.json` | JavaScript / TypeScript (Node) | [references/node.md](references/node.md) |

A repository with both stacks uses both references: one job per stack in the same workflow (for example `Build & Test (.NET)` and `Build & Test (Node)`), each with its own matrix, cache and artifacts. Use path filters only when the stacks live in separate directories and a change to one cannot break the other.

## When to Invoke

- A new CI workflow must be created (e.g., main `ci.yml`, separate `mutation.yml` for nightly mutation runs)
- An existing workflow needs new steps (additional runtime or target framework version, coverage upload, etc.)
- A failing or flaky CI run requires diagnosis and remediation
- Branch protection rules must be aligned with workflow job names

## Prerequisites

- Repository hosted on GitHub with Actions enabled
- The project builds and its tests pass locally with the stack's own commands (listed in the stack reference)
- Stack-specific prerequisites (coverage collector, mutation config) from the stack reference

## Workflow Structure

A CI workflow file under `.github/workflows/`. The `jobs:` section comes from the stack reference; everything above it is shared:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # build-and-test job(s): see references/dotnet.md and/or references/node.md
```

Every build-and-test job follows the same shape: checkout → set up the runtime (with dependency cache) → restore/install → build → stack checks → test with coverage → upload results with `if: always()`.

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions and quality gates.
2. Detect the stack(s) and read the matching reference(s).
3. List existing workflows: `ls .github/workflows/`.
4. Read any existing workflow you will modify in full.
5. Read the version files the stack reference names (e.g., `global.json`, `.nvmrc`) to identify runtime versions.

### Phase 1 — Triggers and Concurrency

Decide which events fire the workflow:
- `push` to `main` — every merge produces a CI run
- `pull_request` to `main` — every PR is validated
- `workflow_dispatch` — manual re-run capability
- `schedule` — only for nightly jobs (e.g., full mutation testing)

Always include `concurrency` with `cancel-in-progress: true` so stale runs from force-pushes don't waste minutes.

### Phase 2 — Matrix Selection

Build a matrix only when behavior differs across dimensions:
- Cross-platform behavior → `os: [ubuntu-latest, windows-latest]`
- Multiple runtime/SDK versions in support → the version axis from the stack reference

`fail-fast: false` — let all matrix legs run so the report shows every failure, not just the first.

### Phase 3 — Caching

Key the dependency cache on the files that determine the resolved package set (project files plus central package management, or the lockfile). A stale key returns the wrong package set; an over-specific key never hits. The stack reference gives the exact key.

### Phase 4 — Quality Gates

Map each project quality gate to a workflow step, using the gate table in the stack reference. Run each step on the output of its predecessor instead of repeating restore/build work.

### Phase 5 — Artifact Upload

Upload test results, coverage reports and mutation reports on every run with `if: always()` so PR reviewers can inspect failures. Name artifacts after the matrix leg (`test-results-${{ matrix.os }}-<version>`) so legs do not overwrite each other. The stack reference lists the exact paths.

### Phase 6 — Branch Protection

After the workflow runs at least once, configure branch protection on `main`:
- Require status checks: every job name from the matrix (e.g., `Build & Test (ubuntu-latest, 8.0.x)`)
- Require branches to be up to date before merging
- Disallow direct pushes

Document the required check names in the PR description so future contributors know what must pass.

## Common Pitfalls

- **No concurrency cancel**: rapid pushes pile up runs and exhaust runner minutes.
- **Coverage collected but not enforced**: integrate with the `sonarqube-pr-quality-gate` skill or a coverage threshold action.
- **Secrets in workflow file**: only reference `${{ secrets.* }}`; never echo them.
- **Status check names changing**: when a job is renamed, branch protection rules silently stop enforcing until updated.
- Stack-specific pitfalls are listed at the end of each stack reference.

## Output

Return to the calling agent:
- Workflow files created or modified
- Detected stack(s) and the reference(s) applied
- Job names that must be added to branch protection
- Any caching, matrix, or secret prerequisites
- Estimated runtime per PR
