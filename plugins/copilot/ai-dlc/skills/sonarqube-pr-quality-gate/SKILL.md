---
name: sonarqube-pr-quality-gate
description: Structured workflow for enforcing SonarQube quality gate on pull requests for .NET and JavaScript/TypeScript projects. Covers sonar-project.properties configuration, the stack's scanner (SonarScanner for .NET; sonarqube-scan-action with lcov coverage for JS/TS), PR decoration, quality-gate-failure as a blocking status check, and integration with the existing sonarqube-cli MCP tooling. Invoked by the devops-engineer agent when SonarQube must gate PRs.
---

# SonarQube PR Quality Gate

You are executing the `sonarqube-pr-quality-gate` skill on behalf of **Gene Kim** (`devops-engineer`). Your job is to wire SonarQube analysis into the GitHub Actions PR flow so that every PR is scanned, decorated with inline findings, and blocked from merging when the project quality gate fails.

> Agent names are the defaults; a name chosen at `/init` (the agent's `persona-name` memory, roster in the orchestrator's `project_team-roster`) takes precedence.

## Stack Detection

This file holds the stack-neutral gate. The scanner, coverage format and report properties live in one reference per stack. Detect the stack (ignore `bin/`, `obj/`, `node_modules/`) and read the matching reference:

| Detected | Stack | Scanner | Reference |
|----------|-------|---------|-----------|
| `*.sln`, `*.slnx` or `*.csproj` | .NET | SonarScanner for .NET (`dotnet-sonarscanner`) | [references/dotnet.md](references/dotnet.md) |
| `package.json` | JavaScript / TypeScript (Node) | `SonarSource/sonarqube-scan-action` | [references/node.md](references/node.md) |

A repository with both stacks keeps **one** SonarQube project and one analysis: run the .NET begin/build/test/end flow and pass the JS/TS coverage and test-report properties (from the node reference) to `dotnet sonarscanner begin`, after the Node tests have produced their reports in the same job (or downloaded them as artifacts). From SonarScanner for .NET 8.0, `sonar.scanner.scanAll` (on by default) makes it analyse the JS/TS files in the repository even when no `.csproj` references them; keep it on, and do not pass `/d:sonar.scanner.scanAll=false`. Check the analysed file list in the first run's SonarQube results and use `sonar.exclusions` for anything that should not be scanned.

## When to Invoke

- SonarQube exists for this repo but PRs are not yet gated by it
- A failing quality gate on `main` must be diagnosed and converted into a blocking PR check
- New rules or coverage thresholds must be enforced through SonarQube
- A PR was merged despite a red SonarQube run — branch protection must be tightened

## Prerequisites

- SonarQube instance accessible at a known URL (e.g., `https://sonarqube.<org>.com`)
- A SonarQube project key created (see `sonarqube-cli`'s `sonar-list-projects`)
- `SONAR_TOKEN` available as a GitHub Actions secret (project-analyzer scope)
- `SONAR_HOST_URL` available as a repo variable
- Coverage already collected during CI in the Sonar-compatible format the stack reference names
- The `sonarqube-cli` MCP toolset already integrated (use `Skill("sonar-integrate")` if not)

## Configuration File

Place `sonar-project.properties` at the repository root. The shared keys:

```
sonar.projectKey=MyProduct
sonar.organization=<organization-or-blank-for-self-hosted>
sonar.host.url=${SONAR_HOST_URL}
sonar.sources=src
sonar.tests=tests
sonar.qualitygate.wait=true
```

Add the stack's exclusions and coverage/test-report properties from the stack reference.

The `sonar.qualitygate.wait=true` line is the keystone — without it the scan returns immediately and the step appears green even when the gate is red.

## Workflow Integration

Add a job to the CI workflow, gated to PRs and pushes to `main`. The stack reference gives the full job; every variant shares:

```yaml
  sonarqube:
    name: SonarQube Quality Gate
    needs: build-and-test
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # required for blame on new code
      # stack reference: produce coverage + test reports, run the scanner
```

On a PR the scan must carry `sonar.pullrequest.key`, `sonar.pullrequest.branch` and `sonar.pullrequest.base`. These cause SonarQube to decorate the PR with inline annotations. The .NET reference passes them explicitly; the scan action used by the node reference detects them automatically (SonarQube Developer Edition and above).

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md`.
2. Detect the stack(s) and read the matching reference(s).
3. Confirm SonarQube project exists: `Skill("sonar-list-projects")` (via the sonarqube-cli MCP).
4. Confirm coverage is being produced in the format the stack reference requires — if not, change the test coverage reporter first.
5. Read any existing `sonar-project.properties` or related workflow steps.

### Phase 1 — Properties File

Author `sonar-project.properties` at repo root with the keystone settings above. Confirm:
- `sonar.projectKey` matches the SonarQube project
- Source and test paths reflect the actual layout
- Exclusion patterns cover generated, sample, build-output and external code
- Coverage and test-report paths match what CI actually writes
- `sonar.qualitygate.wait=true` is present

### Phase 2 — Secrets and Variables

In `Settings → Secrets and variables → Actions`:
- Secret: `SONAR_TOKEN` — project-analyzer token from SonarQube
- Variable: `SONAR_HOST_URL` — the SonarQube base URL

### Phase 3 — Workflow Job

Add the `sonarqube` job from the stack reference. It must:
- Run after build/test (`needs: build-and-test`)
- Fire on `pull_request` and on `push` to `main`
- Pass PR metadata (`sonar.pullrequest.*`) when triggered by a PR, unless the scanner detects it automatically (see the stack reference)

### Phase 4 — Branch Protection

In `Settings → Branches → main`:
- Add `SonarQube Quality Gate` to required status checks
- Require branches to be up to date before merging

### Phase 5 — PR Decoration Verification

Open a test PR with a deliberate code smell. Confirm:
- A GitHub status check `SonarQube Quality Gate` appears
- The check is red when the gate fails
- Inline annotations appear on the PR diff
- Merge is blocked until the gate passes or branch protection is overridden by an admin

### Phase 6 — Failure Diagnostics

When a gate fails on a PR, the developer can:
- Use `Skill("sonar-quality-gate")` to see each failing condition
- Use `Skill("sonar-list-issues")` to list specific issues
- Use `Skill("sonar-fix-issue")` to address them

Document these MCP entrypoints in the PR template so contributors know how to diagnose.

## Common Pitfalls

- **Missing `sonar.qualitygate.wait=true`**: the scan returns instantly with success even when the gate is red.
- **`fetch-depth` not 0**: SonarQube cannot compute new-code blame; the new-code metric becomes the whole project.
- **Token scoped too broadly**: a global admin token in CI is a leakage risk. Use a project-analyzer token.
- **PR scan against the wrong base**: pass `sonar.pullrequest.base=${{ github.base_ref }}` so new-code analysis is correct.
- **`SonarQube Quality Gate` check name not in branch protection**: the gate runs but never blocks. The job name must match exactly.
- Stack-specific pitfalls (coverage format, scanner runtime) are listed at the end of each stack reference.

## Output

Return to the calling agent:
- Files created or modified: `sonar-project.properties`, workflow file
- Detected stack(s) and the reference(s) applied
- Secrets and variables to configure (with names, not values)
- Required status check name to add to branch protection
- A confirmation that a deliberately-failing test PR was used to verify the gate blocks
- Pointers to the `sonarqube-cli` MCP skills for failure diagnostics
