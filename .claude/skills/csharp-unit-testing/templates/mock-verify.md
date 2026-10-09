# mock-verify

```csharp
// Verify called exactly once with any argument
mockValidator.ValidateAsync(Any()).WasCalled(Times.Once);

// Verify called at least once with specific argument
mockValidator.GetUser(42).WasCalled();

// Verify never called
mockNext.Invoke(Any<HttpContext>()).WasCalled(Times.Never);
```
