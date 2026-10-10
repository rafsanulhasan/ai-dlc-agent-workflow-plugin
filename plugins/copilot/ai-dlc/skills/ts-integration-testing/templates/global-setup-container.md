# global-setup-container

Start the container once for the whole run. Hand tests a **connection string**, not the container object: values passed through `provide` cross into the test workers, so keep them serialisable.

```ts
// tests/integration/global-setup.ts
import type { TestProject } from 'vitest/node';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from '../../src/db/migrate';

export default async function setup(project: TestProject) {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('app_test')
    .start();

  await migrate(postgres.getConnectionUri());

  project.provide('databaseUrl', postgres.getConnectionUri());

  return async () => {
    await postgres.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
```

```ts
// in a test file
import { inject } from 'vitest';

const databaseUrl = inject('databaseUrl');
```

The image argument is required. Pin the tag production runs (`postgres:16-alpine`), never `latest`.
