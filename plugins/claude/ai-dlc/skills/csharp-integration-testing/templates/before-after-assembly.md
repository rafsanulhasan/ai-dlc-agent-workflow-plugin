# before-after-assembly

```csharp
public static class TestAssemblyHooks
{
    public static INetwork SharedNetwork { get; private set; } = null!;

    [Before(Assembly)]
    public static async Task CreateSharedNetwork()
    {
        SharedNetwork = await new NetworkBuilder()
            .WithName($"hypermedia-test-{Guid.NewGuid():N}")
            .CreateAsync();
    }

    [After(Assembly)]
    public static async Task DestroySharedNetwork()
    {
        await SharedNetwork.DisposeAsync();
    }
}
```
