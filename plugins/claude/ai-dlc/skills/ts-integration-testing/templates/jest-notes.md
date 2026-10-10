# jest-notes

When the repository uses Jest, the patterns hold with these differences:

| Concern | Vitest | Jest |
|---|---|---|
| Session container | `globalSetup` + `project.provide` / `inject` | `globalSetup` module; pass the connection string through `process.env` (globals set there are visible only in `globalTeardown`) |
| Teardown | function returned from `globalSetup` | separate `globalTeardown` module; keep the container on `globalThis` |
| Timeouts | `testTimeout`, `hookTimeout` | `testTimeout` (default 5000 ms), or `jest.setTimeout()` in a file |
| Soft assertions | `expect.soft` | none: one structural `toEqual` per outcome |
| Serial run | `fileParallelism: false` | `--runInBand` (`-i`) |
| Worker cap | `maxWorkers` | `--maxWorkers=50%` |

```js
// jest.global-setup.js
const { PostgreSqlContainer } = require('@testcontainers/postgresql');

module.exports = async () => {
  globalThis.__POSTGRES__ = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = globalThis.__POSTGRES__.getConnectionUri();
};
```

```js
// jest.global-teardown.js
module.exports = async () => {
  await globalThis.__POSTGRES__.stop();
};
```

Jest does not transform `node_modules` code imported by these two files. MSW 3 and faker 10 are ESM only, so a Jest suite that uses them needs Jest's ESM mode or a transform that covers them.
