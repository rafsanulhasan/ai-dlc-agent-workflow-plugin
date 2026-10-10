# Node (JavaScript / TypeScript) CI steps

Stack-specific part of `github-ci-automation` for a repository with a `package.json` (outside `node_modules/`). The workflow skeleton, triggers, concurrency, artifacts and branch protection are in `SKILL.md`.

## Prerequisites

- A committed lockfile: `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm) or `yarn.lock` (Yarn Berry)
- `package.json` scripts for each gate, e.g. `lint`, `typecheck` (`tsc --noEmit`), `test` (with coverage), `build`
- The test runner writes coverage in **lcov** (`coverage/lcov.info`) and, for SonarQube, a test execution report
- For mutation: StrykerJS (`@stryker-mutator/core` plus the runner plugin) and `stryker.config.json` (or `.mjs`) with `"incremental": true`

## Context to read

- `.nvmrc`, `.node-version`, `engines.node` and the `packageManager` field in `package.json`
- The lockfile, to choose the package manager
- `tsconfig.json`, to know whether a typecheck gate applies (plain JavaScript projects skip it)

## Package manager commands

| Manager | Install (CI) | Run a script | setup-node `cache:` |
|---------|--------------|--------------|---------------------|
| npm | `npm ci` | `npm run <script>` | `npm` |
| pnpm | `pnpm install --frozen-lockfile` | `pnpm <script>` | `pnpm` — install pnpm first with `pnpm/action-setup@v6` |
| Yarn Berry | `yarn install --immutable` | `yarn <script>` | `yarn` |

Do not rely on `corepack enable`: Node 25 and later no longer bundle Corepack. Use `pnpm/action-setup` for pnpm, or `npm install -g corepack` explicitly.

## Job

```yaml
jobs:
  build-and-test-node:
    name: Build & Test (Node)
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node: ['20', '22', '24']
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      # pnpm only: must run before setup-node so the pnpm cache can resolve
      - uses: pnpm/action-setup@v6

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm                     # npm | pnpm | yarn
          cache-dependency-path: pnpm-lock.yaml

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test --coverage   # npm needs `npm test -- --coverage`; or a `test:coverage` script

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: test-results-${{ matrix.os }}-node${{ matrix.node }}
          path: |
            **/junit.xml
            **/sonar-report.xml
            !**/node_modules/**

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: coverage-${{ matrix.os }}-node${{ matrix.node }}
          path: coverage/lcov.info
```

For npm, drop the `pnpm/action-setup` step, set `cache: npm` and use `npm ci` / `npm run <script>`. For Yarn Berry, set `cache: yarn` and use `yarn install --immutable` / `yarn <script>`.

## Mutation job (StrykerJS, incremental on PRs)

StrykerJS incremental mode reuses the results in `reports/stryker-incremental.json` and only re-tests mutants in changed code and tests, which makes it fast enough for pull requests. Stryker does not document how to persist that file in CI; restoring it with `actions/cache` (falling back to `main`'s copy) is a workable pattern.

```yaml
  mutation-node:
    name: Mutation (Node)
    if: github.event_name == 'pull_request' || github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    needs: build-and-test-node
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Restore Stryker incremental file
        uses: actions/cache@v6
        with:
          path: reports/stryker-incremental.json
          key: stryker-${{ github.head_ref || github.ref_name }}-${{ github.sha }}
          restore-keys: |
            stryker-${{ github.head_ref || github.ref_name }}-
            stryker-main-

      - name: StrykerJS (incremental)
        if: github.event_name == 'pull_request'
        run: pnpm exec stryker run --incremental

      - name: StrykerJS (full)
        if: github.event_name != 'pull_request'
        run: pnpm exec stryker run --incremental --force

      - name: Upload mutation report
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: stryker-report
          path: reports/mutation/
```

Run the full (`--force`) job on a schedule or `workflow_dispatch` against `main` so the cached baseline that PRs fall back to stays fresh.

## Matrix axes

- Node versions: every **supported** major that `engines.node` allows (typically the active and maintenance LTS lines, plus the current release if the package claims support). Keep the matrix in step with `engines.node`.
- Cross-platform behavior (path handling, line endings, native modules) → add `windows-latest` / `macos-latest`.
- Run mutation, Sonar and coverage upload for one leg only.

## Caching

Use `actions/setup-node`'s `cache:` input; its key is the lockfile hash (`cache-dependency-path` when the lockfile is not at the root). It caches the package manager's store, not `node_modules/`. setup-node v6+ only enables automatic caching for npm when `packageManager` names npm; set `cache:` explicitly for pnpm and Yarn. In privileged workflows (release, `pull_request_target`) set `package-manager-cache: false` to avoid cache poisoning.

## Quality gates

| Gate | Step |
|------|------|
| Install | `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable` |
| Lint | `<pm> run lint` |
| Typecheck (TypeScript) | `<pm> run typecheck` (`tsc --noEmit`) |
| Build | `<pm> run build` |
| Test + coverage | `<pm> run test` with coverage enabled, writing `coverage/lcov.info` |
| Mutation | `stryker run --incremental` on PRs; `--incremental --force` nightly |

## Artifacts

- JUnit XML and/or the Sonar generic test execution report (`sonar-report.xml`)
- `coverage/lcov.info` (and the HTML coverage report if wanted)
- StrykerJS HTML report (`reports/mutation/`)

## Pitfalls

- **`npm install` in CI**: rewrites the lockfile and hides drift. Use `npm ci` / `--frozen-lockfile` / `--immutable`.
- **pnpm installed after setup-node**: `cache: pnpm` fails. Run `pnpm/action-setup` first.
- **Relying on Corepack**: absent from Node 25+. Install the package manager explicitly.
- **Matrix out of sync with `engines.node`**: CI passes on versions the package no longer claims, or never tests the minimum it claims.
- **Coverage only in text format**: SonarQube needs `lcov`. Configure the runner's lcov reporter.
- **Full StrykerJS on every PR**: too slow. Use `--incremental` on PRs and `--force` on a schedule.
- **Caching `node_modules/`**: breaks across Node versions and native modules. Cache the store via setup-node instead.
