# .NET CI steps

Stack-specific part of `github-ci-automation` for a repository that contains `*.sln`, `*.slnx` or `*.csproj`. The workflow skeleton, triggers, concurrency, artifacts and branch protection are in `SKILL.md`.

## Prerequisites

- `.csproj` files build cleanly locally with `dotnet build`
- Tests pass locally with `dotnet test`
- For coverage: `coverlet.collector` referenced in test projects
- For mutation: Stryker config (`stryker-config.json`) in test project

## Context to read

- `global.json` / `Directory.Build.props` to identify the SDK and target framework versions.

## Job

```yaml
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

## Matrix axes

- Cross-platform behavior → `os: [ubuntu-latest, windows-latest]`
- Multiple SDK versions in support → `dotnet: ['8.0.x', '9.0.x']`

## Caching

The NuGet cache key must include hashes of project files and any central package management file (`Directory.Packages.props`). A stale key returns the wrong package set; an over-specific key never hits. The pattern above balances both.

## Quality gates

| Gate | Step |
|------|------|
| Build | `dotnet build --configuration Release --no-restore` |
| Test | `dotnet test --configuration Release --no-build --logger "trx;LogFileName=test-results.trx" --collect:"XPlat Code Coverage"` |
| Mutation (separate job, runs less frequently) | `dotnet stryker --reporter html --reporter cleartext` |

Always run with `--no-restore` / `--no-build` after their predecessors to avoid redundant work.

## Artifacts

- `.trx` test result files
- `coverage.cobertura.xml` files
- Stryker HTML report (when applicable)

## Pitfalls

- **Forgetting `fetch-depth: 0`**: required for SemVer tools like MinVer, Source Link, and git-blame-based reviews.
- **Hardcoded SDK version**: drifts from the project's `global.json`. Either match it explicitly or read it dynamically.
- **Stryker on every PR**: too slow. Run it nightly or on-demand via `workflow_dispatch`.
