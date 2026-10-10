# Node (JavaScript / TypeScript) SonarQube analysis

Stack-specific part of `sonarqube-pr-quality-gate` for a repository with a `package.json` (outside `node_modules/`). Secrets, the keystone `sonar.qualitygate.wait=true`, branch protection and PR decoration verification are in `SKILL.md`.

JS/TS uses the generic **`SonarSource/sonarqube-scan-action`**. It runs after the tests, reading the coverage and test reports they wrote. No build wrapper is needed.

## Report prerequisites

| Report | Format | Produced by |
|--------|--------|-------------|
| Coverage | lcov (`coverage/lcov.info`) | Vitest: `coverage.reporter` includes `lcov`. Jest: `coverageReporters` includes `lcov`. c8/nyc: `--reporter=lcov`. |
| Test execution | Sonar generic test execution XML (`<testExecutions version="1">`) | Vitest: `vitest-sonar-reporter` (`reporters: ['default', ['vitest-sonar-reporter', { outputFile: 'sonar-report.xml' }]]`; use `@2` for Vitest 1–2). Jest: `jest-sonar` reporter (`reporters: ['default', 'jest-sonar']`) or `jest-sonar-reporter` as `testResultsProcessor`. |

The test execution report is optional for the gate but gives SonarQube test counts and failures. Paths inside the report must resolve to files under `sonar.tests`.

## Properties

```
sonar.projectKey=MyProduct
sonar.organization=<organization-or-blank-for-self-hosted>
sonar.sources=src
sonar.tests=src,tests
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts,**/*.test.js,**/*.spec.js,tests/**
sonar.exclusions=**/node_modules/**,dist/**,build/**,coverage/**,reports/**,**/*.d.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=sonar-report.xml
sonar.qualitygate.wait=true
```

`sonar.javascript.lcov.reportPaths` covers both JavaScript and TypeScript. `sonar.typescript.lcov.reportPaths` is deprecated; do not add it. When tests sit next to sources, list them under both `sonar.sources` and `sonar.tests` and use `sonar.test.inclusions` so they are counted as tests, not production code. In a monorepo, list every package's `lcov.info` comma-separated.

## Job

```yaml
  sonarqube:
    name: SonarQube Quality Gate
    runs-on: ubuntu-latest
    needs: build-and-test-node
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0   # required for blame on new code

      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: npm

      - run: npm ci

      - name: Test with coverage and Sonar report
        run: npm test -- --coverage

      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@v8
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
        with:
          args: >
            -Dsonar.qualitygate.wait=true
```

Instead of re-running the tests, the job may download the `coverage/` and `sonar-report.xml` artifacts from the CI job; the paths must stay identical to the properties file.

- PR metadata: in GitHub Actions the scanner detects the pull request (key, branch, base) automatically on SonarQube Developer Edition and above, so `sonar.pullrequest.*` need not be passed. Pass them explicitly via `args` only when auto-detection is unavailable.
- `args` does not accept full shell syntax (scan action v6+); pass plain `-Dkey=value` pairs and keep the rest in `sonar-project.properties`.
- Java: not needed on the runner. The scanner CLI bundled with scan action v7+ embeds its JRE.
- Scan action v8 verifies the scanner signature and needs `gpg` and `dirmngr` on the runner (present on GitHub-hosted runners; install them on self-hosted runners).
- SonarSource also publishes `SonarSource/sonarqube-quality-gate-action` as a separate gate step. This skill keeps `sonar.qualitygate.wait=true` so the scan job itself is the blocking check.

## Pitfalls

- **Coverage not in lcov**: text or JSON summaries are ignored. Add the `lcov` reporter.
- **lcov paths do not match the scanned sources**: coverage shows 0%. lcov `SF:` paths must be relative to the project base directory (or absolute paths inside the checkout); run the scan from the same root the tests ran in.
- **`dist/` or `coverage/` analysed as source**: inflates duplication and issues. Exclude build output, coverage, Stryker `reports/` and `node_modules/`.
- **Tests counted as production code**: missing `sonar.tests` / `sonar.test.inclusions`, so coverage and issue counts are wrong.
- **Self-hosted runner without `gpg`**: scan action v8 fails signature verification.
