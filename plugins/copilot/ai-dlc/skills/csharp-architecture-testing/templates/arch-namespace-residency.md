# Namespace Residency Rule

Enforce that classes matching a naming pattern must live in a specific namespace.

```csharp
[Test]
public async Task Middlewares_ShouldReside_InMiddlewaresNamespace()
{
    System.Reflection.Assembly assembly = typeof(MyProduct.Middlewares.SomeMiddleware).Assembly;

    TestResult result = Types
        .InAssembly(assembly)
        .That()
        .HaveNameEndingWith("Middleware")
        .Should()
        .ResideInNamespace("MyProduct.Middlewares")
        .GetResult();

    await Assert.That(result.IsSuccessful)
        .IsTrue()
        .Because($"All middleware classes must reside in the project.Middlewares. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
}
```

**Key patterns:**
- `.HaveNameEndingWith("Middleware")` — match classes by naming convention
- `.HaveNameStartingWith("I")` — match interfaces or other prefix patterns
- `.HaveNameMatching(pattern)` — use regex for complex patterns
- `.Should().ResideInNamespace("...")` — enforce a namespace

This ensures structural organization and makes the codebase more navigable.
