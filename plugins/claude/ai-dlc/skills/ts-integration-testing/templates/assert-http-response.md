# assert-http-response

```ts
expect(response.status).toBe(201);
expect(response.headers.location).toMatch(/^\/api\/todos\/[0-9a-f-]{36}$/);
expect(response.headers['content-type']).toMatch(/application\/json/);
```

Assert the status, then the headers the contract promises (`location`, `content-type`, cache headers, `etag`). Don't assert headers the framework adds incidentally.
