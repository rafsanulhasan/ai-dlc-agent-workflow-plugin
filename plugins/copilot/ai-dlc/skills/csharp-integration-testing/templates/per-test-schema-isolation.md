# per-test-schema-isolation

```csharp
public sealed class TodoApiTests : IntegrationTestsBase
{
    private string _schemaName = null!;

    protected override async Task SetupAsync()
    {
        _schemaName = GetIsolatedName("todos");      // e.g., "Test_42_todos"
        await Postgres.CreateSchemaAsync(_schemaName);
    }

    protected override void ConfigureTestConfiguration(IConfigurationBuilder config)
    {
        Dictionary<string, string?> overrides = new()
        {
            ["Database:Schema"] = _schemaName,
        };
        config.AddInMemoryCollection(overrides);
    }
}
```
