---
name: sonarqube-pr-quality-gate
description: Structured workflow for enforcing SonarQube quality gate on pull requests. Covers sonar-project.properties configuration, SonarScanner GitHub Action, PR decoration, quality-gate-failure as a blocking status check, and integration with the existing sonarqube-cli MCP tooling. Invoked by the devops-engineer agent when SonarQube must gate PRs.
---

# SonarQube PR Quality Gate

You are executing the `sonarqube-pr-quality-gate` skill on behalf of the devops-engineer agent. Your job is to wire SonarQube analysis into the GitHub Actions PR flow so that every PR is scanned, decorated with inline findings, and blocked from merging when the project quality gate fails.

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
- Coverage already collected during CI in a Sonar-compatible format (e.g., `coverage.opencover.xml` or `coverage.cobertura.xml` via `dotnet-coverage` or `coverlet`)
- The `sonarqube-cli` MCP toolset already integrated (use `Skill("sonar-integrate")` if not)

## Configuration File

Place `sonar-project.properties` at the repository root:

```
sonar.projectKey=MyProduct
sonar.organization=<organization-or-blank-for-self-hosted>
sonar.host.url=${SONAR_HOST_URL}
sonar.sources=src
sonar.tests=tests
sonar.exclusions=**/bin/**,**/obj/**,samples/**
sonar.cs.opencover.reportsPaths=**/coverage.opencover.xml
sonar.cs.vstest.reportsPaths=**/*.trx
sonar.qualitygate.wait=true
```

The `sonar.qualitygate.wait=true` line is the keystone — without it the scan returns immediately and the step appears green even when the gate is red.

## Workflow Integration

Add a job to the CI workflow (gated to PRs and pushes to `main`):

```yaml
  sonarqube:
    name: SonarQube Quality Gate
    runs-on: windows-latest   # SonarScanner for .NET prefers Windows or Linux; ensure consistency
    needs: build-and-test
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # required for blame on new code

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Cache SonarScanner
        uses: actions/cache@v4
        with:
          path: ~/.sonar/scanner
          key: ${{ runner.os }}-sonar-scanner

      - name: Install SonarScanner for .NET
        run: dotnet tool install --global dotnet-sonarscanner

      - name: Begin Sonar analysis
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
        run: |
          dotnet sonarscanner begin \
            /k:"MyProduct" \
            /d:sonar.host.url="${SONAR_HOST_URL}" \
            /d:sonar.token="${SONAR_TOKEN}" \
            /d:sonar.cs.opencover.reportsPaths="**/coverage.opencover.xml" \
            /d:sonar.cs.vstest.reportsPaths="**/*.trx" \
            /d:sonar.qualitygate.wait=true \
            /d:sonar.pullrequest.key=${{ github.event.pull_request.number }} \
            /d:sonar.pullrequest.branch=${{ github.head_ref }} \
            /d:sonar.pullrequest.base=${{ github.base_ref }}

      - run: dotnet build --configuration Release

      - run: |
          dotnet test --configuration Release --no-build \
            --collect:"XPlat Code Coverage;Format=opencover" \
            --logger "trx"

      - name: End Sonar analysis
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        run: dotnet sonarscanner end /d:sonar.token="${SONAR_TOKEN}"
```

The `sonar.pullrequest.*` parameters cause SonarQube to decorate the PR with inline annotations.

## Workflow

### Phase 0 — Context Load

1. Read `CLAUDE.md`.
2. Confirm SonarQube project exists: `Skill("sonar-list-projects")` (via the sonarqube-cli MCP).
3. Confirm coverage is being produced in OpenCover format — if not, switch the test collector to `Format=opencover`.
4. Read any existing `sonar-project.properties` or related workflow steps.

### Phase 1 — Properties File

Author `sonar-project.properties` at repo root with the keystone settings above. Confirm:
- `sonar.projectKey` matches the SonarQube project
- Source and test paths reflect the actual layout
- Exclusion patterns cover generated, sample, and external code
- `sonar.qualitygate.wait=true` is present

### Phase 2 — Secrets and Variables

In `Settings → Secrets and variables → Actions`:
- Secret: `SONAR_TOKEN` — project-analyzer token from SonarQube
- Variable: `SONAR_HOST_URL` — the SonarQube base URL

### Phase 3 — Workflow Job

Add the `sonarqube` job as above. It must:
- Run after build/test (`needs: build-and-test`)
- Fire on `pull_request` and on `push` to `main`
- Pass PR metadata (`sonar.pullrequest.*`) when triggered by a PR

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
- **Coverage in wrong format**: SonarQube's .NET integration expects OpenCover or VSTest TRX, not Cobertura. Use `--collect:"XPlat Code Coverage;Format=opencover"`.
- **`fetch-depth` not 0**: SonarQube cannot compute new-code blame; the new-code metric becomes the whole project.
- **Token scoped too broadly**: a global admin token in CI is a leakage risk. Use a project-analyzer token.
- **PR scan against the wrong base**: pass `sonar.pullrequest.base=${{ github.base_ref }}` so new-code analysis is correct.
- **`SonarQube Quality Gate` check name not in branch protection**: the gate runs but never blocks. The job name must match exactly.
- **Self-hosted runner missing Java**: `dotnet-sonarscanner` requires JRE 17+. Always add `actions/setup-java`.

## Output

Return to the calling agent:
- Files created or modified: `sonar-project.properties`, workflow file
- Secrets and variables to configure (with names, not values)
- Required status check name to add to branch protection
- A confirmation that a deliberately-failing test PR was used to verify the gate blocks
- Pointers to the `sonarqube-cli` MCP skills for failure diagnostics
