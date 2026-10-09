# Inheritance / Interface Implementation Rule

Enforce that classes matching a pattern must implement a specific interface or inherit from a base class.

```csharp
[Test]
public async Task RequestHandlers_ShouldImplement_IRequestHandler()
{
    System.Reflection.Assembly assembly = typeof(MyProduct.Handlers.SomeHandler).Assembly;

    TestResult result = Types
        .InAssembly(assembly)
        .That()
        .ResideInNamespace("MyProduct.Handlers")
        .And()
        .HaveNameEndingWith("Handler")
        .Should()
        .ImplementInterface(typeof(IRequestHandler))
        .GetResult();

    await Assert.That(result.IsSuccessful)
        .IsTrue()
        .Because($"All handler classes must implement IRequestHandler. Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
}
```

**Key patterns:**
- `.ImplementInterface(typeof(IMyInterface))` — enforce interface implementation
- `.Inherit(typeof(BaseClass))` — enforce base class inheritance
- `.And()` — chain multiple conditions (both namespace AND name pattern must match)
- `.That()` — start a new condition chain

This ensures that all handlers (or controllers, services, etc.) implement a required contract, maintaining consistency and enabling polymorphic behavior.
