# mock-configure

```csharp
// Wildcard matching — matches any argument value
mockValidator.ValidateAsync(Any()).Returns(new ValidationResult { IsValid = true });

// Exact argument matching
mockValidator.GetUser(42).Returns(alice);
```
