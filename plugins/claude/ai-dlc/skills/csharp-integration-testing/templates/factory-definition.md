# factory-definition

```csharp
public sealed class HypermediaTestFactory : TestWebApplicationFactory<Program>
{
    [ClassDataSource<PostgresFixture>(Shared = SharedType.PerTestSession)]
    public required PostgresFixture Postgres { get; init; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            Dictionary<string, string?> overrides = new()
            {
                ["ConnectionStrings:Default"] = Postgres.ConnectionString,
            };
            config.AddInMemoryCollection(overrides);
        });
    }
}
```
