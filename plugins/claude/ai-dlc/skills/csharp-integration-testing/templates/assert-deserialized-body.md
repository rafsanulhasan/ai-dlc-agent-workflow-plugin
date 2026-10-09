# assert-deserialized-body

```csharp
ApiResponse<TodoDto>? body = await response.Content.ReadFromJsonAsync<ApiResponse<TodoDto>>();
using (Assert.Multiple())
{
    await body.Should().NotBeNull();
    await body!.Data.Should().NotBeNull();
    await body.Error.Should().BeNull();
    await body.Data!.Title.Should().BeEqualTo(request.Title);
}
```
