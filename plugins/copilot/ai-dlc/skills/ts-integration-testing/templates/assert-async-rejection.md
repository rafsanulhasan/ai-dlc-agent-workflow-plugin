# assert-async-rejection

When a call should fail at the transport level (connection refused, timeout) rather than return an error response:

```ts
await expect(searchClient.query('todos')).rejects.toThrow(/ECONNREFUSED/);
```

Always `await` the `rejects` assertion. Vitest 5 fails an unawaited one; older runners pass it silently. Never use `try` / `catch` in a test.

An HTTP 4xx or 5xx is not a rejection with supertest, `inject`, `app.request` or `fetch`: assert the status and the `{ data, error }` body (`data-error-shape`).
