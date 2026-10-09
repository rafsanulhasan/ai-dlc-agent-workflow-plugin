# Asserting Results

Always capture the result and check `IsSuccessful` with an informative message.

```csharp
// Always capture the result and check IsSuccessful
TestResult result = architectureRule.GetResult();

// Include failing type names in the assertion for debuggability
await Assert.That(result.IsSuccessful)
    .IsTrue()
    .Because($"Architecture rule violated. Failing types: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
```

**Key patterns:**

1. **Always capture and check:**
   ```csharp
   TestResult result = rule.GetResult();
   Assert.That(result.IsSuccessful).IsTrue();
   ```

2. **Use `.Because()` to include failing types:**
   ```csharp
   await Assert.That(result.IsSuccessful)
       .IsTrue()
       .Because($"Violations: {string.Join(", ", result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
   ```

3. **Collect multiple rule failures with `Assert.Multiple()`:**
   ```csharp
   await Assert.Multiple(() =>
   {
       Assert.That(rule1Result.IsSuccessful).IsTrue()
           .Because($"Rule 1 violations: {string.Join(", ", rule1Result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
       Assert.That(rule2Result.IsSuccessful).IsTrue()
           .Because($"Rule 2 violations: {string.Join(", ", rule2Result.FailingTypes.Select(t => t.FullName ?? t.Name))}");
   });
   ```

This ensures that:
- All violations are visible in the test output
- You see all violations at once (with `Assert.Multiple()`) instead of failing on the first one
- Debugging is easy because you can quickly identify which types violated the rule
