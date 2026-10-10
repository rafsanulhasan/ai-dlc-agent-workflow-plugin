# data-error-shape

The response body is the project's `Result<T>` discriminated union. Exactly one side is set:

```ts
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };
```

Assert **both** sides in one `toEqual`, end to end, so a body that carries data *and* an error cannot pass:

```ts
// Error path
const response = await request(sut.app)
  .post('/api/todos')
  .send(buildCreateTodoRequest({ title: '' }));

expect(response.status).toBe(400);
expect(response.body).toEqual({
  data: null,
  error: expect.stringContaining('title'),
});
```

```ts
// Success path
expect(response.body).toEqual({
  data: { id: expect.any(String), title: payload.title, dueDate: payload.dueDate, done: false },
  error: null,
});
```

Never write `expect(response.body.data).toBeDefined()` on its own: it checks neither the value nor the error side.
