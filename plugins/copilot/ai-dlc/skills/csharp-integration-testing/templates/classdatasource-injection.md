# classdatasource-injection

```csharp
[ClassDataSource<PostgresFixture>(Shared = SharedType.PerTestSession)]
public required PostgresFixture Postgres { get; init; }
```
