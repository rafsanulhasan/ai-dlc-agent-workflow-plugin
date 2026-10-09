# endpoint-integration-test

```csharp
namespace MyProduct.IntegrationTests;

[TestClass]
public sealed class CreateTodoEndpointTests : IntegrationTestsBase
{
    [Test]
    public async Task PostTodos_WithValidPayload_PersistsAndReturnsCreated()
    {
        // Arrange
        string schema = GetIsolatedName("todos");
        await Factory.Postgres.CreateSchemaAsync(schema);

        Faker<CreateTodoRequest> requestFaker = new Faker<CreateTodoRequest>()
            .RuleFor(r => r.Title, f => f.Lorem.Sentence(3))
            .RuleFor(r => r.DueDate, f => f.Date.FutureOffset());
        CreateTodoRequest request = requestFaker.Generate();

        HttpClient client = Factory.CreateClient();

        // Act
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/todos", request);

        // Assert
        ApiResponse<TodoDto>? body = await response.Content.ReadFromJsonAsync<ApiResponse<TodoDto>>();
        using (Assert.Multiple())
        {
            await response.StatusCode.Should().BeEqualTo(HttpStatusCode.Created);
            await response.Headers.Location.Should().NotBeNull();
            await body.Should().NotBeNull();
            await body!.Data.Should().NotBeNull();
            await body.Error.Should().BeNull();
            await body.Data!.Title.Should().BeEqualTo(request.Title);
        }

        // Side-effect verification — the row really exists in Postgres
        await using NpgsqlConnection conn = new(Factory.Postgres.ConnectionString);
        await conn.OpenAsync();
        long persistedCount = await conn.ExecuteScalarAsync<long>(
            $"select count(*) from {schema}.todos where id = @id",
            new { id = body!.Data!.Id });
        await persistedCount.Should().BeEqualTo(1);
    }

    [Test]
    public async Task PostTodos_WithEmptyTitle_ReturnsValidationError()
    {
        // Arrange
        CreateTodoRequest request = new() { Title = string.Empty, DueDate = DateTimeOffset.UtcNow.AddDays(1) };
        HttpClient client = Factory.CreateClient();

        // Act
        HttpResponseMessage response = await client.PostAsJsonAsync("/api/todos", request);

        // Assert
        ApiResponse<TodoDto>? body = await response.Content.ReadFromJsonAsync<ApiResponse<TodoDto>>();
        using (Assert.Multiple())
        {
            await response.StatusCode.Should().BeEqualTo(HttpStatusCode.BadRequest);
            await body.Should().NotBeNull();
            await body!.Data.Should().BeNull();
            await body.Error.Should().NotBeNullOrEmpty();
            await body.Error.Should().Contain("Title");
        }
    }
}
```
