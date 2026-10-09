# bogus-test-data

```csharp
Faker<User> userFaker = new()
    .RuleFor(u => u.Id, f => f.Random.Guid())
    .RuleFor(u => u.Email, f => f.Internet.Email())
    .RuleFor(u => u.Name, f => f.Name.FullName());

User testUser = userFaker.Generate();
```
