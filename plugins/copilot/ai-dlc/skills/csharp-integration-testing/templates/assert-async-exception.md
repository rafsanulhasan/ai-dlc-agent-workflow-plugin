# assert-async-exception

```csharp
Func<Task> act = async () => await client.GetAsync("/will-fail");
await act.Should().Throw<HttpRequestException>();
```
