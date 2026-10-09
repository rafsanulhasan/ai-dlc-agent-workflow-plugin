# Naming Convention Rule

Enforce naming patterns across your codebase.

```csharp
[Test]
public async Task Interfaces_ShouldBeNamed_WithIPrefix()
{
    System.Reflection.Assembly assembly = typeof(MyProduct.SomeKnownType).Assembly;

    TestResult result = Types
        .InAssembly(assembly)
        .That()
        .AreInterfaces()
        .Should()
        .HaveNameStartingWith("I")
        .GetResult();

    await Assert.That(result.IsSuccessful)
        .IsTrue()
        .Because($"All interfaces must start with 'I'. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
}
```

**Key patterns:**
- `.AreInterfaces()` — target interface types
- `.AreClasses()` — target class types
- `.AreAbstract()` — target abstract types
- `.AreSealed()` — target sealed types
- `.HaveNameStartingWith("I")` — enforce prefix
- `.HaveNameEndingWith("Exception")` — enforce suffix
- `.HaveNameMatching(pattern)` — use regex for complex patterns

This ensures consistency across the codebase and makes intent clear from type names.
