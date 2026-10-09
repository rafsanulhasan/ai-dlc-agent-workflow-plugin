# assert-http-response

```csharp
await response.StatusCode.Should().BeEqualTo(HttpStatusCode.Created);
await response.Headers.Location.Should().NotBeNull();
```
