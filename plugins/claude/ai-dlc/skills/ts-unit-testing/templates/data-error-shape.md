# data-error-shape

The project's result type is a discriminated union — exactly one side is set:

```ts
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };
```

Assert **both** sides in one structural assertion, so a result that carries data *and* an error cannot pass:

```ts
// Success case
const result = await handler.handle(validRequest);

expect(result).toEqual({
  data: { id: expectedId, name: expectedName },
  error: null,
});

// Error case
const errorResult = await handler.handle(invalidRequest);

expect(errorResult).toEqual({
  data: null,
  error: expect.stringContaining('validation failed'),
});
```

When the data object carries generated fields you do not control (timestamps, ids), match them with asymmetric matchers rather than dropping the `data` side:

```ts
expect(result).toEqual({
  data: { id: expect.any(String), name: request.name, createdAt: expect.any(Date) },
  error: null,
});
```

Never write `expect(result.data).toBeDefined()` on its own — it checks neither the value nor the error side.
