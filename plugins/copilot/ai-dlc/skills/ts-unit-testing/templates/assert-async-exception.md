# assert-async-exception

```ts
// Arrange
const handler = new GetUserHandler(repository);
const request = { id: '' };

// Act + Assert
await expect(handler.handle(request)).rejects.toThrow(ArgumentError);
```

Always `await` (or `return`) the `rejects` assertion. Without it the test finishes before the promise settles and passes regardless of the outcome.

If the code returns `{ data: null, error }` instead of throwing, assert the result shape (`data-error-shape`) — do not expect a rejection.
