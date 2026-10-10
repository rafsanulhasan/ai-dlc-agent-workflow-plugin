# assert-sync-exception

```ts
// Arrange
const validator = new RequestValidator();
const invalidInput = fromPartial<HttpRequest>({ headers: {} });

// Act + Assert
expect(() => validator.validate(invalidInput)).toThrow(ValidationError);
```

Pass a **function** to `expect`, not the call's result — `expect(validator.validate(x)).toThrow()` throws before `expect` runs. Never use `try` / `catch` in a test.

To check the message as well, pass a string (substring match), a RegExp, or an object:

```ts
expect(() => validator.validate(invalidInput)).toThrow(/authorization header/i);
```
