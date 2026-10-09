# before-after-container

```csharp
public sealed class TodoRepositoryTests
{
    private PostgreSqlContainer _postgres = null!;

    [Before(Class)]
    public async Task StartPostgres()
    {
        _postgres = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .WithDatabase("hypermedia_test")
            .Build();
        await _postgres.StartAsync();
    }

    [After(Class)]
    public async Task StopPostgres()
    {
        await _postgres.StopAsync();
        await _postgres.DisposeAsync();
    }
}
```
