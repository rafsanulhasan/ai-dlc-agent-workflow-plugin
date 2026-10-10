# Standard Rules

Rules every project should carry. `depcruise --init` generates most of them (as `warn` for the first two); raise the severity to `error` once the code is clean.

```js
// .dependency-cruiser.cjs — inside `forbidden`
{
  name: 'no-circular',
  comment: 'Cycles make modules impossible to understand, test or load in isolation.',
  severity: 'error',
  from: {},
  to: { circular: true },
},
{
  name: 'no-orphans',
  comment: 'A module nobody imports is dead code, or an entry point that should be listed here.',
  severity: 'error',
  from: {
    orphan: true,
    pathNot: [
      '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$',   // dotfiles
      '[.]d[.]ts$',
      '(^|/)tsconfig[.]json$',
      '^src/server\\.ts$',                                  // entry points
    ],
  },
  to: {},
},
{
  name: 'not-to-dev-dep',
  comment: 'Production code must not import devDependencies: they are not installed in production.',
  severity: 'error',
  from: { path: '^src/', pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
  to: {
    dependencyTypes: ['npm-dev'],
    dependencyTypesNot: ['type-only'],
    pathNot: ['node_modules/@types/'],
  },
},
{
  name: 'no-non-package-json',
  comment: 'Every package you import must be declared in package.json.',
  severity: 'error',
  from: {},
  to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
},
{
  name: 'not-to-unresolvable',
  severity: 'error',
  from: {},
  to: { couldNotResolve: true },
},
{
  name: 'not-to-spec',
  comment: 'Production code must not import test files.',
  severity: 'error',
  from: {},
  to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
},
```

**Restricted imports** — a library may be used only in one place:

```js
{
  name: 'db-driver-only-in-repositories',
  comment: 'Only repositories talk to the database driver; everything else goes through them.',
  severity: 'error',
  from: { pathNot: '\\.repository\\.ts$' },
  to: { path: '(^|/)node_modules/(pg|knex|drizzle-orm)/' },
},
{
  name: 'no-node-builtins-in-domain',
  comment: 'The domain stays runtime-agnostic.',
  severity: 'error',
  from: { path: '^src/domain/' },
  to: { dependencyTypes: ['core'] },
},
```

The `(^|/)node_modules/` prefix also matches the nested paths pnpm resolves to (`node_modules/.pnpm/pg@8/node_modules/pg/...`).

Useful `dependencyTypes` values: `local`, `npm`, `npm-dev`, `npm-optional`, `npm-peer`, `npm-no-pkg`, `npm-unknown`, `core`, `deprecated`, `type-only`.
