# before-after-full-stack

```csharp
public sealed class CreateTodoEndpointTests
{
    private PostgreSqlContainer _postgres = null!;
    private HypermediaTestFactory _factory = null!;
    private HttpClient _client = null!;
    private string _schema = null!;

    [Before(Class)]
    public async Task StartInfrastructure()
    {
        // Container first
        _postgres = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .WithDatabase("hypermedia_test")
            .Build();
        await _postgres.StartAsync();

        // Factory second — wires the container's connection string in
        _factory = new HypermediaTestFactory(_postgres.GetConnectionString());
        await _factory.InitializeAsync();
    }

    [Before(Test)]
    public async Task SetupTest()
    {
        // Per-test: isolated schema + fresh client + resolved services
        _schema = $"test_{Guid.NewGuid():N}"[..16];
        await _postgres.CreateSchemaAsync(_schema);
        _client = _factory.CreateClient();
    }

    [After(Test)]
    public async Task TeardownTest()
    {
        _client.Dispose();
        await _postgres.DropSchemaAsync(_schema);
    }

    [After(Class)]
    public async Task StopInfrastructure()
    {
        // Dispose in reverse order: factory first, container second
        await _factory.DisposeAsync();
        await _postgres.StopAsync();
        await _postgres.DisposeAsync();
    }
}
```
