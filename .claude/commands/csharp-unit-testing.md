---
description: Comprehensive guidance for writing C# unit tests using TUnit, TUnit.Mocks, Bogus, and TUnit.Assertions.Should with project conventions
---

# charp-unit-testing

## Operating Methodology

Invoke this skill when writing C# unit tests for AI-DLC Agent Workflow. It provides a complete reference for testing frameworks, mocking patterns, test data generation, assertion patterns, and project-specific conventions (including the `{ data, error }` return shape).

The skill covers:
- **TUnit** for the test framework
- **TUnit.Mocks** for mocking dependencies
- **Bogus** for realistic test data generation
- **TUnit.Assertions.Should** for readable assertions
- **Assert.Multiple()** for collecting all failures before reporting
- **Arrange, Act, Assert (AAA)** pattern for test structure
- **Exception assertions** with merged Act+Assert using TUnit.Assertions.Should

Use this skill before writing any C# test code to ensure consistency with project standards.

## Key Patterns

### Arrange, Act, Assert (AAA)

Every test must follow AAA structure: set up the SUT (Arrange), call it once (Act), verify results (Assert). One Act per test — if you need multiple calls, write multiple tests.

### Exception Assertions

Use TUnit.Assertions.Should's `.Should().Throw<>()` or `.Should().ThrowAsync<>()` with lambda-wrapped calls. Never use try/catch in tests.

**Async:**

```csharp
Func<Task> act = async () => await handler.HandleAsync(invalidRequest);
await act.Should().Throw<ArgumentException>();
```

**Sync:**

```csharp
Action act = () => validator.Validate(invalidInput);
await act.Should().Throw<ValidationException>();
```

**Note:** To assert exception messages, use `Assert.That()` — TUnit.Assertions.Should does not expose `.WithMessage()` on exception assertions.
