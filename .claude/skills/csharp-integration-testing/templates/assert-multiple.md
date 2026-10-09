# assert-multiple

```csharp
using (Assert.Multiple())
{
    await response.StatusCode.Should().BeEqualTo(HttpStatusCode.OK);
    await body.Data.Should().NotBeNull();
    await body.Error.Should().BeNull();
    await body.Data!.Items.Should().HaveCount(3);
}
```
