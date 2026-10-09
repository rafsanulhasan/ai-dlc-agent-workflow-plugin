# multi-container-topology

```csharp
public sealed class DockerNetwork : IAsyncInitializer, IAsyncDisposable
{
    public INetwork Instance { get; } = new NetworkBuilder()
        .WithName($"hypermedia-test-{Guid.NewGuid():N}")
        .Build();

    public async Task InitializeAsync() => await Instance.CreateAsync();

    public async ValueTask DisposeAsync() => await Instance.DisposeAsync();
}

public sealed class KafkaFixture : IAsyncInitializer, IAsyncDisposable
{
    [ClassDataSource<DockerNetwork>(Shared = SharedType.PerTestSession)]
    public required DockerNetwork Network { get; init; }

    public KafkaContainer Container { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Container = new KafkaBuilder()
            .WithNetwork(Network.Instance)
            .Build();
        await Container.StartAsync();
    }

    public async ValueTask DisposeAsync() => await Container.DisposeAsync();
}
```
