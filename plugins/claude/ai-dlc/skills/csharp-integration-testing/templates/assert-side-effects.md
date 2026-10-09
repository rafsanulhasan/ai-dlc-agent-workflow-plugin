# assert-side-effects

```csharp
await using NpgsqlConnection conn = new(Postgres.ConnectionString);
await conn.OpenAsync();
long count = await conn.ExecuteScalarAsync<long>(
    "select count(*) from todos where id = @id", new { id = body.Data!.Id });
await count.Should().BeEqualTo(1);
```
