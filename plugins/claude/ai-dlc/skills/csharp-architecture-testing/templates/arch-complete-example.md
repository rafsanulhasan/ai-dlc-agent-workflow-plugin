# Complete Architecture Testing Example

A complete `ArchitectureTests.cs` file demonstrating all rule categories and patterns.

```csharp
using NetArchTest.Rules;
using TUnit.Assertions;

[TestClass]
public sealed class ArchitectureTests
{
    private static System.Reflection.Assembly CoreAssembly
        => typeof(MyProduct.SomeCoreType).Assembly;

    [Test]
    public async Task Domain_ShouldNot_DependOn_Infrastructure()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .ResideInNamespace("MyProduct.Domain")
            .ShouldNot()
            .HaveDependencyOn("MyProduct.Infrastructure")
            .GetResult();

        await Assert.That(result.IsSuccessful)
            .IsTrue()
            .Because($"Domain must not reference Infrastructure. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
    }

    [Test]
    public async Task Middlewares_ShouldReside_InMiddlewaresNamespace()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .HaveNameEndingWith("Middleware")
            .Should()
            .ResideInNamespace("MyProduct.Middlewares")
            .GetResult();

        await Assert.That(result.IsSuccessful)
            .IsTrue()
            .Because($"Middleware classes must live in the project.Middlewares. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
    }

    [Test]
    public async Task Interfaces_ShouldBeNamed_WithIPrefix()
    {
        TestResult result = Types
            .InAssembly(CoreAssembly)
            .That()
            .AreInterfaces()
            .Should()
            .HaveNameStartingWith("I")
            .GetResult();

        await Assert.That(result.IsSuccessful)
            .IsTrue()
            .Because($"All interfaces must start with 'I'. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
    }

    [Test]
    public async Task AllRules_CollectedTogether()
    {
        TestResult domainRule = Types.InAssembly(CoreAssembly).That()
            .ResideInNamespace("MyProduct.Domain")
            .ShouldNot().HaveDependencyOn("MyProduct.Infrastructure")
            .GetResult();

        TestResult interfaceRule = Types.InAssembly(CoreAssembly).That()
            .AreInterfaces().Should().HaveNameStartingWith("I")
            .GetResult();

        TestResult middlewareRule = Types.InAssembly(CoreAssembly).That()
            .HaveNameEndingWith("Middleware")
            .Should().ResideInNamespace("MyProduct.Middlewares")
            .GetResult();

        await Assert.Multiple(async () =>
        {
            await Assert.That(domainRule.IsSuccessful).IsTrue()
                .Because($"Domain/Infrastructure isolation violated: {string.Join(", ", domainRule.FailingTypes.Select(t => t.FullName ?? t.Name))}");
            await Assert.That(interfaceRule.IsSuccessful).IsTrue()
                .Because($"Interface naming violated: {string.Join(", ", interfaceRule.FailingTypes.Select(t => t.FullName ?? t.Name))}");
            await Assert.That(middlewareRule.IsSuccessful).IsTrue()
                .Because($"Middleware namespace violated: {string.Join(", ", middlewareRule.FailingTypes.Select(t => t.FullName ?? t.Name))}");
        });
    }
}
```

**Key elements in this example:**

1. **Static property for assembly loading** — `CoreAssembly` is loaded once and reused across all tests
2. **One test per rule** — first three tests enforce individual rules
3. **`Assert.Multiple()` for batch assertions** — the fourth test collects all rules and asserts them together
4. **Informative failure messages** — each assertion includes `FailingTypes` so you know which types violated the rule
5. **TUnit async tests** — uses `[Test]` and `async Task` with `await Assert.That(...)`
6. **Explicit namespaces** — imports are clear (`NetArchTest.Rules`, `TUnit.Assertions`)

This example demonstrates:
- Layer isolation (Domain/Infrastructure separation)
- Namespace residency (Middlewares must be in the Middlewares namespace)
- Naming conventions (Interfaces start with 'I')
- Multi-rule batching (collect all failures before reporting)
