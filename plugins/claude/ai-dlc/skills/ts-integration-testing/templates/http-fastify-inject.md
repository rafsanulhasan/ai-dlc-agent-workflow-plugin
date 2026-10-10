# http-fastify-inject

Fastify's `inject` runs the full plugin, hook, validation and serialisation pipeline without opening a socket.

```ts
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { buildServer } from '../../src/server';

let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  app = await buildServer({ databaseUrl: inject('databaseUrl') });
});

afterAll(async () => {
  await app.close();   // runs onClose hooks: pools, clients
});

it('creates a todo and returns it', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/todos',
    payload: { title: 'Write the integration suite' },
  });

  expect(response.statusCode).toBe(201);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.json()).toEqual({
    data: { id: expect.any(String), title: 'Write the integration suite', done: false },
    error: null,
  });
});
```

`inject` never touches the network, so MSW does not see these calls.
