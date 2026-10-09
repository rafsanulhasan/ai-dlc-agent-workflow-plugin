# aspire-fixture-direct

```csharp
[ClassDataSource<AspireFixture<Projects.AiDlcAgentWorkflow_AppHost>>(Shared = SharedType.PerTestSession)]
public sealed class WeatherApiTests(AspireFixture<Projects.AiDlcAgentWorkflow_AppHost> fixture)
{
    [Test]
    public async Task GetForecast_ReturnsOk()
    {
        HttpClient client = fixture.CreateHttpClient("apiservice");
        HttpResponseMessage response = await client.GetAsync("/weatherforecast");
        await response.StatusCode.Should().BeEqualTo(HttpStatusCode.OK);
    }
}
```
