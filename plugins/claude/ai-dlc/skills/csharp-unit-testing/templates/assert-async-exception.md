# assert-async-exception

```csharp
// Arrange
GetUserHandler handler = new(mockRepo);
GetUserRequest request = new() { Id = Guid.Empty };

// Act + Assert
Func<Task> act = async () => await handler.HandleAsync(request);
await act.Should().Throw<ArgumentException>();
```
