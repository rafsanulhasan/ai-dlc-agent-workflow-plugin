# assert-multiple

```csharp
using (Assert.Multiple())
{
    await result.Data.Should().NotBeNull();
    await result.Error.Should().BeNull();
    await result.Data!.Id.Should().BeEqualTo(expectedId);
    await result.Data!.Name.Should().BeEqualTo(expectedName);
    await result.Data!.CreatedAt.Should().BeLessThanOrEqualTo(DateTime.UtcNow);
}
```
