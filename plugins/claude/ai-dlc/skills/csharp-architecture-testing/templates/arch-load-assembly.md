# Loading an Assembly

Use `Types.InAssembly(typeof(SomeTypeFromAssembly).Assembly)` to target an assembly.

```csharp
// Load the assembly containing the type you want to test
System.Reflection.Assembly assembly = typeof(MyProduct.SomeKnownType).Assembly;

ConditionList types = Types
    .InAssembly(assembly)
    .That()
    .ResideInNamespace("MyProduct");
```

For solution-wide rules, load multiple assemblies and chain `.And()`:

```csharp
System.Reflection.Assembly coreAssembly = typeof(MyProduct.Core.SomeType).Assembly;
System.Reflection.Assembly infrastructureAssembly = typeof(MyProduct.Infrastructure.SomeType).Assembly;

// Check rule across both assemblies
ConditionList types = Types
    .InAssembly(coreAssembly)
    .And()
    .InAssembly(infrastructureAssembly)
    .That()
    .ArePublic();
```
