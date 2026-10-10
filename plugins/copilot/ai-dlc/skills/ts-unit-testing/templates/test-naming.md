# test-naming

`describe` names the unit; `it` states the scenario and the expected outcome as a sentence. Read together they form the specification line.

```ts
describe('validateRequest', () => {
  it('returns a success result when the auth header is present', () => { /* ... */ });

  it('returns an error result when the auth header is missing', () => { /* ... */ });
});

describe('GetUserHandler.handle', () => {
  it('returns an error when the user does not exist', async () => { /* ... */ });
});
```

When the test traces to a numbered acceptance criterion, prefix the `it` name with the AC ID:

```ts
it('[AC-3] rejects an order whose total exceeds the credit limit', async () => { /* ... */ });
```

If the repository already uses the `Method_Scenario_Outcome` shape (`it('validate_WhenAuthHeaderIsMissing_ReturnsError')`), keep it — consistency with existing tests wins.
