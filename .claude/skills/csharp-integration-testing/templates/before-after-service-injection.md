# before-after-service-injection

```csharp
public sealed class TodoApiTests
{
    private HypermediaTestFactory _factory = null!;
    private HttpClient _client = null!;
    private ITodoRepository _repository = null!;
    private string _schema = null!;

    [Before(Class)]
    public async Task CreateFactory()
    {
        _factory = new HypermediaTestFactory();
        await _factory.InitializeAsync();
    }

    [Before(Test)]
    public async Task SetupTest()
    {
        // Fresh client per test — prevents cookie/header state leaking between tests
        _client = _factory.CreateClient();

        // Resolve services from the factory's DI container
        _repository = _factory.Services.GetRequiredService<ITodoRepository>();

        // Per-test isolation: each test owns its own schema
        _schema = $"test_{TestContext.Current!.TestDetails.TestId:N}"[..16];
        await _factory.Postgres.CreateSchemaAsync(_schema);
    }

    [After(Test)]
    public async Task CleanupTest()
    {
        _client.Dispose();
        await _factory.Postgres.DropSchemaAsync(_schema);
    }

    [After(Class)]
    public async Task DisposeFactory()
    {
        await _factory.DisposeAsync();
    }
}
```
