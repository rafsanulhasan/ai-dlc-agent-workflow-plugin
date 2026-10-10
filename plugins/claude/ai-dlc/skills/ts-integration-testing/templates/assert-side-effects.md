# assert-side-effects

Verify a write through the interface a caller would use: read it back.

```ts
// Act
const created = await request(sut.app).post('/api/todos').send(payload);

// Assert — the side effect is visible through the public API
const fetched = await request(sut.app).get(created.headers.location);

expect(fetched.status).toBe(200);
expect(fetched.body).toEqual({
  data: { id: created.body.data.id, title: payload.title, dueDate: payload.dueDate, done: false },
  error: null,
});
```

The GET belongs to the assertion; it is not a second act.

Query the database directly only when storage **is** the contract under test: a migration, a repository mapping test, or a column another system reads.

```ts
const { rows } = await db.query('select title from todos where id = $1', [id]);
expect(rows).toEqual([{ title: payload.title }]);
```
