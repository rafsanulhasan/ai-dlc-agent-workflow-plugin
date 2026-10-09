---
name: github-ci-automation
description: Structured workflow for designing and maintaining GitHub Actions continuous integration for .NET projects. Covers workflow file structure, push/pull_request triggers, build matrix, caching, dotnet build/test/stryker integration, uploading test results and coverage artifacts, branch protection integration, and PR status checks. Invoked by the devops-engineer agent when CI workflows need to be created or updated.
---

# GitHub CI Automation

You are executing the `github-ci-automation` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to produce or modify `.github/workflows/*.yml` files that build, test, and validate the project on every push and pull request — gating merges with deterministic status checks.

> Agent names are the defaults; a name chosen at `/ai-dlc:init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## When to Invoke

- A new CI workflow must be created (e.g., main `ci.yml`, separate `mutation.yml` for nightly stryker)
- An existing workflow needs new steps (additional target framework, coverage upload, etc.)
- A failing or flaky CI run requires diagnosis and remediation
- Branch protection rules must be aligned with workflow job names

## Prerequisites

- Repository hosted on GitHub with Actions enabled
- `.csproj` files build cleanly locally with `dotnet build`
- Tests pass locally with `dotnet test`
- For coverage: `coverlet.collector` referenced in test projects
- For mutation: Stryker config (`stryker-config.json`) in test project

## Workflow Structure

A CI workflow file under `.github/workflows/`:

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
  build-and-test:
    name: Build & Test
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        dotnet: ['8.0.x', '9.0.x']
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ matrix.dotnet }}

      - name: Cache NuGet
        uses: actions/cache@v4
        with:
          path: ~/.nuget/packages
          key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj', '**/Directory.Packages.props') }}
          restore-keys: ${{ runner.os }}-nuget-

      - name: Restore
        run: dotnet restore

      - name: Build
        run: dotnet build --configuration Release --no-restore

      - name: Test
        run: dotnet test --configuration Release --no-build --logger "trx;LogFileName=test-results.trx" --collect:"XPlat Code Coverage"

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.os }}-${{ matrix.dotnet }}
          path: '**/TestResults/*.trx'

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.os }}-${{ matrix.dotnet }}
          path: '**/TestResults/**/coverage.cobertura.xml'
```

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md` for project conventions and quality gates.
2. List existing workflows: `ls .github/workflows/`.
3. Read any existing workflow you will modify in full.
4. Read `global.json` / `Directory.Build.props` to identify target framework versions.

### Phase 1 — Triggers and Concurrency

Decide which events fire the workflow:
- `push` to `main` — every merge produces a CI run
- `pull_request` to `main` — every PR is validated
- `workflow_dispatch` — manual re-run capability
- `schedule` — only for nightly jobs (e.g., mutation testing)

Always include `concurrency` with `cancel-in-progress: true` so stale runs from force-pushes don't waste minutes.

### Phase 2 — Matrix Selection

Build a matrix only when behavior differs across dimensions:
- Cross-platform behavior → `os: [ubuntu-latest, windows-latest]`
- Multiple SDK versions in support → `dotnet: ['8.0.x', '9.0.x']`

`fail-fast: false` — let all matrix legs run so the report shows every failure, not just the first.

### Phase 3 — Caching

NuGet cache key must include hashes of project files and any central package management file (`Directory.Packages.props`). A stale key returns the wrong package set; an over-specific key never hits. The provided pattern balances both.

### Phase 4 — Quality Gates

Map each project quality gate to a workflow step:

| Gate | Step |
|------|------|
| Build | `dotnet build --configuration Release --no-restore` |
| Test | `dotnet test --configuration Release --no-build --logger "trx;LogFileName=test-results.trx" --collect:"XPlat Code Coverage"` |
| Mutation (separate job, runs less frequently) | `dotnet stryker --reporter html --reporter cleartext` |

Always run with `--no-restore` / `--no-build` after their predecessors to avoid redundant work.

### Phase 5 — Artifact Upload

Upload these on every run with `if: always()` so PR reviewers can inspect failures:
- `.trx` test result files
- `coverage.cobertura.xml` files
- Stryker HTML report (when applicable)

### Phase 6 — Branch Protection

After the workflow runs at least once, configure branch protection on `main`:
- Require status checks: every job name from the matrix (e.g., `Build & Test (ubuntu-latest, 8.0.x)`)
- Require branches to be up to date before merging
- Disallow direct pushes

Document the required check names in the PR description so future contributors know what must pass.

## Common Pitfalls

- **Forgetting `fetch-depth: 0`**: required for SemVer tools like MinVer, Source Link, and git-blame-based reviews.
- **Hardcoded SDK version**: drifts from the project's `global.json`. Either match it explicitly or read it dynamically.
- **No concurrency cancel**: rapid pushes pile up runs and exhaust runner minutes.
- **Stryker on every PR**: too slow. Run it nightly or on-demand via `workflow_dispatch`.
- **Coverage collected but not enforced**: integrate with the `sonarqube-pr-quality-gate` skill or a coverage threshold action.
- **Secrets in workflow file**: only reference `${{ secrets.* }}`; never echo them.
- **Status check names changing**: when a job is renamed, branch protection rules silently stop enforcing until updated.

## Output

Return to the calling agent:
- Workflow files created or modified
- Job names that must be added to branch protection
- Any caching, matrix, or secret prerequisites
- Estimated runtime per PR
