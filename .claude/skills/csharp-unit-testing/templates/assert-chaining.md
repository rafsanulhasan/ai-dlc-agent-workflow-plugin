# assert-chaining

```csharp
await value
    .Should().BeEqualTo(5)
    .And.NotBeEqualTo(7)
    .And.BeBetween(1, 10);

await statusCode
    .Should().BeEqualTo(200)
    .Or.BeEqualTo(201);
```
