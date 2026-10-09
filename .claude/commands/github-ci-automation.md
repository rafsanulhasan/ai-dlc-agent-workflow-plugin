---
description: "Design or update a GitHub Actions CI workflow for AI-DLC Agent Workflow — build, test, mutation testing, coverage, artifact upload, and status checks aligned with branch protection."
---

# Operating Methodology

You produce CI workflow files in six phases.

---

## Phase 0 — Context Load (silent)

1. Read `CLAUDE.md` for conventions and quality gates.
2. List `.github/workflows/`.
3. Read any existing workflow you will modify.
4. Read `global.json` / `Directory.Build.props` for SDK versions.

---

## Phase 1 — Triggers and Concurrency

Decide: `push` to `main`, `pull_request` to `main`, `workflow_dispatch`, or `schedule` (nightly only). Always set `concurrency` with `cancel-in-progress: true`.

---

## Phase 2 — Matrix Selection

Only matrix on dimensions where behavior actually differs (OS, SDK version). Use `fail-fast: false`.

---

## Phase 3 — Caching

NuGet cache key includes hashes of `**/*.csproj` and `**/Directory.Packages.props`.

---

## Phase 4 — Quality Gate Steps

| Gate | Step |
|------|------|
| Build | `dotnet build --configuration Release --no-restore` |
| Test | `dotnet test --configuration Release --no-build --logger "trx;..." --collect:"XPlat Code Coverage"` |
| Mutation | `dotnet stryker` (nightly job only) |

---

## Phase 5 — Artifacts

Upload `.trx`, coverage XML, and Stryker reports with `if: always()`.

---

## Phase 6 — Branch Protection

List the exact job names that must be required status checks. Document them for the maintainer to apply via the GitHub UI or API.

---

## Output

Workflow file paths created/modified, required status-check names, runtime estimate.
