# .NET SonarQube analysis

Stack-specific part of `sonarqube-pr-quality-gate` for a repository that contains `*.sln`, `*.slnx` or `*.csproj`. Secrets, the keystone `sonar.qualitygate.wait=true`, branch protection and PR decoration verification are in `SKILL.md`.

.NET uses **SonarScanner for .NET** (`dotnet-sonarscanner`), which wraps the build in `begin` / `end` steps. It does not use the generic scan action.

## Coverage prerequisite

Coverage collected during CI in a Sonar-compatible format: `coverage.opencover.xml` (via `dotnet-coverage` or `coverlet`) and VSTest `.trx` results. Confirm coverage is produced in OpenCover format — if not, switch the test collector to `Format=opencover`.

## Properties

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

## Job

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

## Pitfalls

- **Coverage in wrong format**: SonarQube's .NET integration expects OpenCover or VSTest TRX, not Cobertura. Use `--collect:"XPlat Code Coverage;Format=opencover"`.
- **Self-hosted runner missing Java**: `dotnet-sonarscanner` requires JRE 17+. Always add `actions/setup-java`.
