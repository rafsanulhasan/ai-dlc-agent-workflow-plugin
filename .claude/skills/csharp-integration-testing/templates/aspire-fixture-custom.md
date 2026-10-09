# aspire-fixture-custom

```csharp
public sealed class HypermediaAspireFixture : AspireFixture<Projects.AiDlcAgentWorkflow_AppHost>
{
    protected override TimeSpan ResourceTimeout => TimeSpan.FromMinutes(3);

    protected override IEnumerable<string> ResourcesToRemove() =>
        ["pgadmin", "redisinsight", "seq"];

    protected override void ConfigureBuilder(IDistributedApplicationTestingBuilder builder)
    {
        builder.Services.ConfigureHttpClientDefaults(c => c.AddStandardResilienceHandler());
    }
}
```
