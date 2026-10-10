# Complete Architecture Testing Example

A layered service: `src/domain`, `src/application`, `src/infrastructure`, `src/api`, with feature modules under `src/modules/<name>/` and the entry point `src/server.ts`.

## The rules

```js
// .dependency-cruiser.cjs
const TEST_FILE = '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Layers
    {
      name: 'domain-not-to-outer-layers',
      comment: 'The domain must not know about use cases, adapters or transport.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(application|infrastructure|api)/' },
    },
    {
      name: 'application-not-to-adapters',
      comment: 'Use cases depend on ports, never on adapters.',
      severity: 'error',
      from: { path: '^src/application/' },
      to: { path: '^src/(infrastructure|api)/' },
    },
    {
      name: 'infrastructure-not-to-api',
      severity: 'error',
      from: { path: '^src/infrastructure/' },
      to: { path: '^src/api/' },
    },
    {
      name: 'modules-only-through-public-index',
      comment: 'Another module is reachable only through its index.ts.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },

    // Folder residency
    {
      name: 'controllers-live-in-api',
      severity: 'error',
      from: { path: '\\.controller\\.ts$', pathNot: '^src/api/' },
      to: {},
    },

    // Restricted imports
    {
      name: 'db-driver-only-in-repositories',
      severity: 'error',
      from: { pathNot: '\\.repository\\.ts$' },
      to: { path: '(^|/)node_modules/pg/' },
    },

    // Standard hygiene
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'no-orphans',
      severity: 'error',
      from: { orphan: true, pathNot: ['[.]d[.]ts$', '^src/server\\.ts$'] },
      to: {},
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      from: { path: '^src/', pathNot: TEST_FILE },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] },
    },
    { name: 'not-to-spec', severity: 'error', from: {}, to: { path: TEST_FILE } },
    { name: 'not-to-unresolvable', severity: 'error', from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
```

## The tests

```ts
// tests/architecture/architecture.test.ts
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

interface Violation {
  from: string;
  to: string;
  rule: { name: string; severity: string };
}

let violations: Violation[];

beforeAll(() => {
  const run = spawnSync(
    'npx',
    ['depcruise', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
    { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 },
  );
  violations = JSON.parse(run.stdout).summary.violations;
}, 120_000);

const brokenBy = (ruleName: string) =>
  violations.filter((v) => v.rule.name === ruleName).map((v) => `${v.from} -> ${v.to}`);

const sourceFiles = (readdirSync('src', { recursive: true }) as string[])
  .map((file) => `src/${file.replaceAll('\\', '/')}`);

describe('architecture', () => {
  it('keeps the domain free of outer layers', () => {
    expect(brokenBy('domain-not-to-outer-layers')).toEqual([]);
  });

  it('keeps every controller under src/api', () => {
    const misplaced = sourceFiles.filter(
      (file) => file.endsWith('.controller.ts') && !file.startsWith('src/api/'),
    );

    expect(misplaced).toEqual([]);
  });

  it('names every file in src/application/handlers *.handler.ts', () => {
    const wrong = sourceFiles.filter(
      (file) =>
        file.startsWith('src/application/handlers/') &&
        !file.endsWith('.handler.ts') &&
        !file.endsWith('/index.ts'),
    );

    expect(wrong).toEqual([]);
  });

  it('breaks no error-severity dependency rule', () => {
    const errorRules = new Set(
      violations.filter((v) => v.rule.severity === 'error').map((v) => v.rule.name),
    );

    for (const rule of errorRules) {
      expect.soft(brokenBy(rule), rule).toEqual([]);
    }
    expect([...errorRules]).toEqual([]);
  });
});
```

**Key elements in this example:**

1. **One config file** holds every dependency rule, each with a `name`, a `severity` and (for the non-obvious ones) a `comment` saying why.
2. **One test per rule category** — layer, folder residency, naming — so a failure names what broke.
3. **A catch-all test** lists the edges of every broken `error` rule with `expect.soft`, so all of them show in one run; `warn` rules are reported by the CLI but do not fail the test.
4. **Readable failures** — violations become `from -> to` strings and misplaced files are listed by path; nothing is reduced to a count or a boolean.
5. **Folder and naming checks walk the file tree**, so files with no imports are covered too.

To see the suite fail first, add a throwaway import from `src/domain` to `src/infrastructure`, run the tests, confirm `domain-not-to-outer-layers` lists that edge, then remove it.
