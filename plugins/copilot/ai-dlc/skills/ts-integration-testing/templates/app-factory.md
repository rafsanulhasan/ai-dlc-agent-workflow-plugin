# app-factory

The app must be buildable from configuration, without starting a listener, so tests can point it at the containers. This is the TypeScript counterpart of a test host factory.

```ts
// src/app.ts — production code
import express from 'express';
import pg from 'pg';
import { todoRoutes } from './todos/routes';

export interface AppConfig {
  databaseUrl: string;
  dbSchema?: string;
  billingBaseUrl: string;
  clock?: () => Date;
}

export function buildApp(config: AppConfig) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    options: config.dbSchema ? `-c search_path=${config.dbSchema}` : undefined,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/todos', todoRoutes({
    pool,
    billingBaseUrl: config.billingBaseUrl,
    clock: config.clock ?? (() => new Date()),
  }));
  return { app, close: () => pool.end() };
}
```

```ts
// src/server.ts — the only file that listens
import { buildApp } from './app';
import { loadConfig } from './config';

const { app } = buildApp(loadConfig(process.env));
app.listen(Number(process.env.PORT ?? 3000));
```

Replace a dependency for a test (a fixed clock) through this config: pass a real test double in, do not mock the module.

If the app reads `process.env` at import time and builds itself as a side effect, report it to the engineer as a testability finding (`write-tests`, "Testable boundaries") instead of working around it with module mocks.
