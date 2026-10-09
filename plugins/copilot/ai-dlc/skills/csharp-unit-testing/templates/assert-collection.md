# assert-collection

```csharp
await result.Items.Should().HaveCount(3);
await result.Items.Should().Any(x => x.Status == "Active");
await result.Items.Should().All(x => x.CreatedAt <= DateTime.UtcNow);
```
