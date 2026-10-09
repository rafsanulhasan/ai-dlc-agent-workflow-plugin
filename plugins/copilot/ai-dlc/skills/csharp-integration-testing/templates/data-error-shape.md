# data-error-shape

```csharp
ApiResponse<TodoDto>? body = await response.Content.ReadFromJsonAsync<ApiResponse<TodoDto>>();
using (Assert.Multiple())
{
    await body.Should().NotBeNull();
    await body!.Data.Should().BeNull();
    await body.Error.Should().NotBeNullOrEmpty();
    await body.Error.Should().Contain("validation failed");
}
```
