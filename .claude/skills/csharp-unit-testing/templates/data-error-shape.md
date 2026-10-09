# data-error-shape

```csharp
// Success case
ApiResponse<UserDto> response = await handler.HandleAsync(validRequest);
using (Assert.Multiple())
{
    await response.Data.Should().NotBeNull();
    await response.Error.Should().BeNull();
    await response.Data!.Id.Should().BeEqualTo(expectedId);
}

// Error case
ApiResponse<UserDto> errorResponse = await handler.HandleAsync(invalidRequest);
using (Assert.Multiple())
{
    await errorResponse.Data.Should().BeNull();
    await errorResponse.Error.Should().NotBeNullOrEmpty();
    await errorResponse.Error.Should().Contain("validation failed");
}
```
