---
name: csharp-unit-testing
description: Comprehensive guidance for writing C# unit tests using TUnit, TUnit.Mocks, Bogus, and TUnit.Assertions.Should with project conventions
---

# csharp-unit-testing

This skill encodes best practices for writing C# unit tests in the project. It guides test implementation using a standardized stack: **TUnit** for the test framework, **TUnit.Mocks** for mocking, **Bogus** for test data generation, and **TUnit.Assertions.Should** for powerful assertions. It also reinforces project conventions like the `{ data, error }` return shape and Assert.Multiple() failure collection.

---

## Phase 0 — Context Load (silent)

1. Read `.claude/CLAUDE.md` and `.claude/rules/testing.md`
2. Invoke `Skill("ai-dlc:manage-memory", args: "sqa-engineer")` to load persistent memory
3. Note the project conventions:
   - All API responses use `{ data, error }` shape
   - Test framework: TUnit
   - Mocking: TUnit.Mocks
   - Test data: Bogus
   - Assertions: TUnit.Assertions.Should

---

## Phase 1 — C# Unit Testing Conventions

### Testing Framework: TUnit

TUnit is the project's testing framework. Use it for:
- Creating test classes (mark with `[TestClass]`)
- Defining test methods (mark with `[Test]`)
- Test organization and discovery

**Why TUnit:** Lightweight, modern, integrates well with .NET 6+, and aligns with the project's architecture.

### Mocking Framework: TUnit.Mocks

TUnit.Mocks handles mock creation and behavior configuration. Always use it when a unit test needs to isolate the system under test (SUT) from its dependencies.

**Pattern 1: Create a mock**

[`templates/mock-create.md`](templates/mock-create.md)

**Pattern 2: Configure return behavior**

[`templates/mock-configure.md`](templates/mock-configure.md)

**Pattern 3: Verify invocation**

[`templates/mock-verify.md`](templates/mock-verify.md)

**Pattern 4: Argument matching**

[`templates/mock-argument-matching.md`](templates/mock-argument-matching.md)

**Why TUnit.Mocks:** Zero ceremony — the mock IS the interface. Setup and verification are expressed as plain method calls, not lambda expressions.

### Test Data Generation: Bogus

Bogus generates realistic test data. Always use it instead of hardcoded test data, especially for complex objects.

**Pattern 1: Create a Faker instance**

[`templates/bogus-test-data.md`](templates/bogus-test-data.md)

**Pattern 2: Generate multiple instances**

[`templates/bogus-generate-multiple.md`](templates/bogus-generate-multiple.md)

**Why Bogus:** Produces realistic, varied test data; reduces brittleness from hardcoded values; makes tests easier to read and maintain.

### Assertion Library: TUnit.Assertions.Should

TUnit.Assertions.Should provides readable, fluent assertions. Always use it instead of basic `Assert` statements.

**Pattern 1: Simple assertions**

[`templates/assert-simple.md`](templates/assert-simple.md)

**Pattern 2: Collection assertions**

[`templates/assert-collection.md`](templates/assert-collection.md)

Note: `.Any(predicate)` and `.All(predicate)` are hand-written in TUnit.Assertions.Should and take a plain `Func<TItem, bool>` — not nested `.Should()` chains.

**Pattern 3: Exception assertions (Act + Assert merged)**

When asserting that a method call throws an exception, assign the call to a lambda and assert on it. This merges Act and Assert into one focused block.

**Async exception:**

[`templates/assert-async-exception.md`](templates/assert-async-exception.md)

**Sync exception:**

[`templates/assert-sync-exception.md`](templates/assert-sync-exception.md)

**Critical rule:** Always use TUnit.Assertions.Should's `.Should().Throw<>()` — this works for both `Action` (sync) and `Func<Task>` (async) delegates. Never use `.ThrowAsync<>()` (it does not exist in TUnit.Assertions.Should) and never use try/catch.

**Note:** To assert exception messages, use `Assert.That()` — TUnit.Assertions.Should does not expose `.WithMessage()` on exception assertions.

**Pattern 4: And/Or chaining**

[`templates/assert-chaining.md`](templates/assert-chaining.md)

Note: Do not mix `.And` and `.Or` in the same chain — TUnit will throw `MixedAndOrAssertionsException`.

**Pattern 5: Justification**

```csharp
await score.Should().BeGreaterThan(70).Because("passing grade is required");
```

**Why TUnit.Assertions.Should:** Reads like English, provides rich failure messages, fluent syntax integrates seamlessly with TUnit.

### Assert.Multiple: Collect All Failures

Always wrap multiple assertions in `Assert.Multiple()` to collect all failures before reporting. This is critical for debugging — you see all problems at once instead of fixing them one-by-one.

[`templates/assert-multiple.md`](templates/assert-multiple.md)

If any assertion fails, the block collects all failures and reports them together. This saves debugging time.

**Why Assert.Multiple():** Avoids stopping at the first failure; lets you see the full picture of what went wrong in a single test run. Native to TUnit assertion framework.

### The `{ data, error }` Return Shape

All API responses (per the project convention) use a consistent shape:
```csharp
public record ApiResponse<T>(T? Data, string? Error);
```

Always assert BOTH `Data` and `Error` fields. Never verify only one side. This ensures the response shape is correct.

[`templates/data-error-shape.md`](templates/data-error-shape.md)

### Test Naming Convention

Use descriptive test names that explain the scenario and expected outcome using the `Method_Scenario_Outcome` shape:

[`templates/test-naming.md`](templates/test-naming.md)

### Test Structure: Arrange, Act, Assert (AAA)

Every test follows the **Arrange, Act, Assert** pattern to keep test logic clear and maintainable. This structure separates concerns and makes tests easier to understand at a glance.

**Arrange** — Set up dependencies, test data, and the system under test (SUT). Configure mocks, build test objects with Bogus, and prepare any preconditions needed.

**Act** — Call the method under test exactly once. This is a single line of code that invokes the SUT with the arranged inputs. Any logic here should belong in production code, not the test.

**Assert** — Verify that the result matches expectations using TUnit.Assertions.Should. Use `Assert.Multiple()` to collect all failures at once.

[`templates/test-structure.md`](templates/test-structure.md)

**Critical rule: one Act per test.** If a test needs to call the SUT more than once, split it into separate tests. Each test should verify a single behavior path.

---

## Phase 2 — Complete Example: Middleware Test

Here is a complete example testing a middleware component using all conventions together:

[`templates/middleware-unit-test.md`](templates/middleware-unit-test.md)

---

## Phase 3 — Key Takeaways

When writing C# unit tests for .NET projects:

1. **Use TUnit** — it's the project's test framework
2. **Mock with TUnit.Mocks** — fluent, intuitive, and integrated with TUnit
3. **Generate test data with Bogus** — realistic, varied, maintainable
4. **Assert with TUnit.Assertions.Should** — readable, fluent, powerful
5. **Collect failures with Assert.Multiple()** — see all problems at once
6. **Always assert both Data and Error** — the `{ data, error }` shape is mandatory
7. **Name tests clearly** — explain scenario and expected outcome
8. **Test behavior, not implementation** — tests must survive refactoring

Follow these patterns consistently across all test suites.
