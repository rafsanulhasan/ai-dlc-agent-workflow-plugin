# test-naming

`describe` names the endpoint (verb and route); `it` states the scenario and the outcome as a sentence.

```ts
describe('POST /api/todos', () => {
  it('persists the todo and returns 201 with its location', async () => { /* ... */ });

  it('returns 400 and a validation error when the title is empty', async () => { /* ... */ });
});

describe('GET /api/todos', () => {
  it('returns an empty list when no todos exist', async () => { /* ... */ });
});
```

When the test traces to a numbered acceptance criterion, prefix the `it` name with the AC ID:

```ts
it('[AC-3] rejects a todo whose due date is in the past', async () => { /* ... */ });
```

If the repository already uses another shape, keep it: consistency with existing tests wins.
