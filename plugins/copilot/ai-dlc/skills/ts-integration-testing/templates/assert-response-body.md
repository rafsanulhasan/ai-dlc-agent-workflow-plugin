# assert-response-body

```ts
expect(response.body).toEqual({
  data: {
    id: expect.any(String),
    title: payload.title,
    dueDate: payload.dueDate,
    done: false,
  },
  error: null,
});
```

One `toEqual` on the whole body: an extra field, a missing field or a wrong type shows in one diff. Use asymmetric matchers (`expect.any`, `expect.stringMatching`) only for values the test cannot know, such as generated ids and timestamps.
