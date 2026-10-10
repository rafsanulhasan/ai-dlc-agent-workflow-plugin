# vitest-config

```ts
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup-msw.ts'],
    testTimeout: 30_000,   // the 5_000 default is too short for real I/O
    hookTimeout: 120_000,  // container start and migrations run in hooks
    pool: 'forks',         // the default; keeps native drivers out of worker threads
    maxWorkers: '50%',     // cap parallel files on shared runners
  },
});
```

```json
{
  "scripts": {
    "test": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

Keep the integration suite in its own config (or its own Vitest project) so the unit run stays fast and needs no Docker. `poolOptions` was removed in Vitest 4: the worker limit is the top-level `maxWorkers`.
