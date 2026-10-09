# Layer Dependency Rule

Enforce that one layer must not depend on another layer.

```csharp
[Test]
public async Task Domain_ShouldNot_DependOn_Infrastructure()
{
    System.Reflection.Assembly assembly = typeof(AiDlcAgentWorkflow.Domain.SomeDomainType).Assembly;

    TestResult result = Types
        .InAssembly(assembly)
        .That()
        .ResideInNamespace("AiDlcAgentWorkflow.Domain")
        .ShouldNot()
        .HaveDependencyOn("AiDlcAgentWorkflow.Infrastructure")
        .GetResult();

    await Assert.That(result.IsSuccessful)
        .IsTrue()
        .Because($"Domain must not depend on Infrastructure. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
}
```

The `.HaveDependencyOn()` method checks if any type in the source namespace directly or indirectly references a type in the target namespace.

**Key patterns:**
- `ShouldNot().HaveDependencyOn()` — strict isolation between layers
- `.Should().HaveDependencyOn()` — enforce a required dependency direction
- `And()` to combine multiple namespace checks in a single rule
