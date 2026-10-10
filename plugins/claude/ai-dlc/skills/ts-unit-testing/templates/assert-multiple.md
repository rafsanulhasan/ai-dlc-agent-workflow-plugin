# assert-multiple

The TypeScript way to collect all failures at once.

**First choice: one structural assertion.** `toEqual` on the whole value compares every field and prints a single diff that shows all the mismatches:

```ts
expect(result).toEqual({
  data: { id: expectedId, name: expectedName, status: 'active' },
  error: null,
});
```

**Independent checks: `expect.soft`.** A soft assertion records its failure and lets the test continue. At the end the test fails and reports every recorded failure:

```ts
expect.soft(response.status).toBe(201);
expect.soft(response.headers.location).toMatch(/^\/api\/todos\//);
expect.soft(body).toEqual({
  data: expect.objectContaining({ title: request.title }),
  error: null,
});
```

`expect.soft` is available in Vitest and Playwright Test. Jest has no soft assertions; there, use one structural `toEqual` / `toMatchObject`.
