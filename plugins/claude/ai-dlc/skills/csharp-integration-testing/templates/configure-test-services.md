# configure-test-services

```csharp
protected override void ConfigureTestServices(IServiceCollection services)
{
    // Replace clock so deterministic assertions are possible
    services.ReplaceService<IClock>(new FixedClock(DateTimeOffset.UnixEpoch));
}
```
