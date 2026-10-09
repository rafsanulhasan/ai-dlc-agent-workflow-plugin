# bogus-test-data

```csharp
Faker<CreateTodoRequest> requestFaker = new Faker<CreateTodoRequest>()
    .RuleFor(r => r.Title, f => f.Lorem.Sentence(3))
    .RuleFor(r => r.DueDate, f => f.Date.FutureOffset());

CreateTodoRequest request = requestFaker.Generate();
```
