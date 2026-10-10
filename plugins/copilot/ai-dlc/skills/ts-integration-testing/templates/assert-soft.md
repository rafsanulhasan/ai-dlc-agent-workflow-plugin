# assert-soft

`expect.soft` records a failure and keeps going, so one slow container cycle shows every broken layer at once.

```ts
expect.soft(response.status).toBe(201);
expect.soft(response.headers.location).toMatch(/^\/api\/todos\//);
expect.soft(response.body).toEqual({
  data: expect.objectContaining({ title: payload.title }),
  error: null,
});
```

Use it for independent facts about one outcome. Keep a hard `expect` where later lines cannot run without it (for example, before reading `response.body.data.id`).

Jest has no `expect.soft`; fold the facts into one structural `toEqual` instead.
