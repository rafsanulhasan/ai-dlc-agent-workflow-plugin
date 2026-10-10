# per-test-schema-isolation

One container, one schema per test (or per file). The app under test is built against that schema, so parallel tests never see each other's rows.

```ts
// tests/integration/support/isolated-schema.ts
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../../../src/db/migrate';

export async function createIsolatedSchema(databaseUrl: string) {
  const schema = `test_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`create schema ${schema}`);
  await migrate(databaseUrl, { schema });

  return {
    schema,
    drop: async () => {
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    },
  };
}
```

```ts
let isolated: Awaited<ReturnType<typeof createIsolatedSchema>>;
let sut: ReturnType<typeof buildApp>;

beforeEach(async () => {
  isolated = await createIsolatedSchema(inject('databaseUrl'));
  sut = buildApp({ databaseUrl: inject('databaseUrl'), dbSchema: isolated.schema, billingBaseUrl });
});

afterEach(async () => {
  await sut.close();       // the app's pool first
  await isolated.drop();   // then the schema
});
```

**Golden rule:** if a resource is shared, every test addresses its own slice of it: schema, table prefix, queue or topic name, cache key prefix, bucket path.
