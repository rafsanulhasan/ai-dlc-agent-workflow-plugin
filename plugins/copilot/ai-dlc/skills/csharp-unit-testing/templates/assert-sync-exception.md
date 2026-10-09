# assert-sync-exception

```csharp
// Arrange
RequestValidator validator = new();
HttpRequest invalidInput = new Faker<HttpRequest>().Generate();

// Act + Assert
Action act = () => validator.Validate(invalidInput);
await act.Should().Throw<ValidationException>();
```
