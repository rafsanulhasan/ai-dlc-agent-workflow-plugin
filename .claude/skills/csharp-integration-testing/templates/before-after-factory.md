# before-after-factory

```csharp
public sealed class TodoApiTests
{
    private HypermediaTestFactory _factory = null!;

    [Before(Class)]
    public async Task CreateFactory()
    {
        _factory = new HypermediaTestFactory();
        await _factory.InitializeAsync();
    }

    [After(Class)]
    public async Task DisposeFactory()
    {
        await _factory.DisposeAsync();
    }
}
```
