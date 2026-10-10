# transaction-isolation

Rolling back a transaction after each test is faster than a schema per test, but it only works when the app runs **every** query on the connection the test hands it.

```ts
let client: pg.PoolClient;
let sut: ReturnType<typeof buildApp>;

beforeEach(async () => {
  client = await pool.connect();
  await client.query('begin');
  sut = buildApp({ db: client, billingBaseUrl });   // the app uses this client, not its own pool
});

afterEach(async () => {
  await client.query('rollback');
  client.release();
});
```

Do not use it when the code under test:

- opens its own transactions (a nested `begin` is only a warning in Postgres, not a savepoint);
- uses a second connection (background jobs, `LISTEN` / `NOTIFY`, a separate read pool);
- is a migration, or anything whose committed result you need to observe.

Use a schema per test (`per-test-schema-isolation`) in those cases. For a suite that must run serially against one database, `postgres.snapshot()` after migrations and `postgres.restoreSnapshot()` between tests also works; close every client connection before either call.
