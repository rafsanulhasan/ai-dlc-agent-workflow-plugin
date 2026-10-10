# http-hono-request

A Hono app answers `app.request(path, init)` in process, without a server.

```ts
const response = await app.request('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Write the integration suite' }),
});

expect(response.status).toBe(201);
expect(await response.json()).toEqual({
  data: { id: expect.any(String), title: 'Write the integration suite', done: false },
  error: null,
});
```

For a typed client, `testClient(app)` from `hono/testing` gives calls such as `client.api.todos.$get()`. It carries route types only when the routes are chained on the `Hono` instance (`new Hono().get(...).post(...)`).
